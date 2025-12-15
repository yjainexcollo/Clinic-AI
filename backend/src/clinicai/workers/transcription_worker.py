"""
Background worker for processing transcription jobs from Azure Queue Storage.
This runs as a separate process/service.
"""
import asyncio
import json
import logging
import sys
import os
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

# Add src to path for imports
current_dir = Path(__file__).parent.parent.parent.parent
src_path = current_dir / "src"
sys.path.insert(0, str(src_path))

from clinicai.adapters.queue.azure_queue_service import get_azure_queue_service
from clinicai.adapters.db.mongo.repositories.patient_repository import MongoPatientRepository
from clinicai.adapters.db.mongo.repositories.visit_repository import MongoVisitRepository
from clinicai.adapters.db.mongo.repositories.audio_repository import AudioRepository
from clinicai.api.deps import get_transcription_service
from clinicai.application.use_cases.transcribe_audio import TranscribeAudioUseCase
from clinicai.application.dto.patient_dto import AudioTranscriptionRequest
from clinicai.core.config import get_settings
from clinicai.domain.value_objects.patient_id import PatientId
from clinicai.domain.value_objects.visit_id import VisitId

logger = logging.getLogger(__name__)


class TranscriptionWorker:
    """Worker that processes transcription jobs from Azure Queue."""
    
    def __init__(self):
        self.queue_service = get_azure_queue_service()
        self.patient_repo = MongoPatientRepository()
        self.visit_repo = MongoVisitRepository()
        self.audio_repo = AudioRepository()
        self.transcription_service = get_transcription_service()  # Uses same service selection as API
        self.settings = get_settings()
        
        # Worker configuration
        self.poll_interval = self.settings.azure_queue.poll_interval
        self.max_processing_time = 1800  # 30 minutes max processing time
        
    async def initialize(self):
        """Initialize worker (database connections, etc.)."""
        # Ensure queue exists
        # Note: Queue existence is ensured at startup, not per worker run
        logger.info("✅ Transcription worker initialized")
    
    async def get_audio_data(self, audio_file_id: str) -> Optional[bytes]:
        """Get audio file data from blob storage with logging."""
        download_start_time = time.time()
        try:
            audio_file = await self.audio_repo.get_audio_file_by_id(audio_file_id)
            if not audio_file:
                logger.error(f"Audio file {audio_file_id} not found")
                return None
            
            # Get blob reference
            from clinicai.adapters.db.mongo.repositories.blob_file_repository import BlobFileRepository
            blob_repo = BlobFileRepository()
            blob_ref = await blob_repo.get_blob_reference_by_id(audio_file.blob_reference_id)
            
            if not blob_ref:
                logger.error(f"Blob reference {audio_file.blob_reference_id} not found")
                return None
            
            # Download from blob storage (with timeout and retry handled in blob_service)
            from clinicai.adapters.storage.azure_blob_service import get_azure_blob_service
            blob_service = get_azure_blob_service()
            audio_data = await blob_service.download_file(blob_ref.blob_path)
            
            download_duration = time.time() - download_start_time
            logger.info(
                f"✅ Downloaded audio data: {audio_file_id}, "
                f"size={len(audio_data)} bytes ({len(audio_data) / (1024*1024):.2f}MB), "
                f"duration={download_duration:.2f}s"
            )
            
            return audio_data
        except Exception as e:
            download_duration = time.time() - download_start_time
            logger.error(
                f"Failed to get audio data: {e} (duration: {download_duration:.2f}s)",
                exc_info=True
            )
            return None
    
    async def process_job(self, job_data: dict, message_id: str, pop_receipt: str):
        """Process a single transcription job with improved logging and error handling."""
        job_start_time = time.time()
        timings = {
            "dequeue_wait": 0.0,  # Not tracked here (would need dequeue timestamp)
            "blob_sas_generation": 0.0,
            "job_create": 0.0,
            "poll": 0.0,
            "results_fetch": 0.0,
            "postprocess": 0.0,
            "db_save": 0.0,
        }
        
        patient_id = job_data["patient_id"]
        visit_id = job_data["visit_id"]
        audio_file_id = job_data["audio_file_id"]
        language = job_data.get("language", "en")
        retry_count = job_data.get("retry_count", 0)
        request_id = job_data.get("request_id")
        
        # IDEMPOTENCY GUARD: Check visit status BEFORE doing any work
        try:
            visit = await self.visit_repo.find_by_patient_and_visit_id(
                patient_id, VisitId(visit_id)
            )
            if not visit:
                logger.warning(f"Visit {visit_id} not found, deleting message {message_id}")
                try:
                    await self.queue_service.delete_message(message_id, pop_receipt)
                except Exception:
                    pass  # Best effort cleanup
                return
            
            # Check if already completed
            if visit.transcription_session and visit.transcription_session.transcription_status == "completed":
                logger.info(f"Transcription already completed for visit {visit_id}, skipping duplicate job {message_id}")
                try:
                    await self.queue_service.delete_message(message_id, pop_receipt)
                except Exception:
                    pass  # Best effort cleanup
                return
            
            # Check if already failed (don't retry failed jobs)
            if visit.transcription_session and visit.transcription_session.transcription_status == "failed":
                logger.info(f"Transcription already marked as failed for visit {visit_id}, skipping job {message_id}")
                try:
                    await self.queue_service.delete_message(message_id, pop_receipt)
                except Exception:
                    pass  # Best effort cleanup
                return
            
            # Check for stale processing state (worker may have crashed)
            # If processing for > 20 minutes, allow retry (treat as stale)
            if visit.transcription_session and visit.transcription_session.transcription_status == "processing":
                if visit.transcription_session.started_at:
                    age = datetime.utcnow() - visit.transcription_session.started_at
                    if age < timedelta(minutes=20):
                        # Recent processing (< 20 min) - extend visibility to avoid duplicate processing
                        # Don't delete message - original worker may still be running
                        logger.info(
                            f"⚠️ Transcription already processing for visit {visit_id} "
                            f"(started {age.total_seconds():.0f}s ago). Extending visibility to prevent duplicate processing."
                        )
                        try:
                            # Extend visibility timeout to match remaining processing time
                            remaining_seconds = max(300, (timedelta(minutes=20) - age).total_seconds())
                            await self.queue_service.update_message_visibility(
                                message_id,
                                pop_receipt,
                                visibility_timeout=int(remaining_seconds)
                            )
                            logger.debug(f"Extended message {message_id} visibility by {remaining_seconds:.0f}s")
                        except Exception as visibility_error:
                            logger.warning(f"Failed to extend visibility for duplicate message: {visibility_error}")
                        return
                    else:
                        # Stale processing (> 20 min) - original worker likely crashed
                        # Reset to allow retry
                        logger.warning(
                            f"⚠️ Stale processing state detected for visit {visit_id} "
                            f"(started {age.total_seconds():.0f}s ago). Resetting to allow retry."
                        )
                        # Reset transcription session to allow retry
                        visit.transcription_session.transcription_status = "pending"
                        visit.transcription_session.started_at = None
                        visit.transcription_session.error_message = None
                        visit.transcription_session.transcription_id = None
                        visit.transcription_session.last_poll_status = None
                        visit.transcription_session.last_poll_at = None
                        await self.visit_repo.save(visit)
                        logger.info(f"Reset stale transcription session for visit {visit_id}, proceeding with retry")
        except Exception as idempotency_check_error:
            logger.error(f"Error during idempotency check: {idempotency_check_error}", exc_info=True)
            # Continue processing - better to retry than skip if check fails
        
        # Set dequeued_at timestamp
        dequeued_at = datetime.utcnow()
        if visit.transcription_session:
            visit.transcription_session.dequeued_at = dequeued_at
            await self.visit_repo.save(visit)
        
        logger.info(
            f"Processing transcription job: visit={visit_id}, "
            f"audio_file={audio_file_id}, language={language}, retry={retry_count}, "
            f"message_id={message_id}, request_id={request_id or 'none'}, "
            f"dequeued_at={dequeued_at.isoformat()}"
        )
        
        temp_file_path = None
        visibility_task = None
        latest_pop_receipt = pop_receipt  # Track latest pop_receipt for deletion
        
        try:
            # Get audio file metadata and blob reference (for SAS URL)
            audio_file = await self.audio_repo.get_audio_file_by_id(audio_file_id)
            if not audio_file:
                raise ValueError(f"Audio file {audio_file_id} not found")
            
            from clinicai.adapters.db.mongo.repositories.blob_file_repository import BlobFileRepository
            blob_repo = BlobFileRepository()
            blob_ref = await blob_repo.get_blob_reference_by_id(audio_file.blob_reference_id)
            if not blob_ref:
                raise ValueError(f"Blob reference {audio_file.blob_reference_id} not found")
            
            # Generate SAS URL for existing audio blob (avoids re-upload for Azure Speech)
            sas_start = time.time()
            from clinicai.adapters.storage.azure_blob_service import get_azure_blob_service
            blob_service = get_azure_blob_service()
            sas_url = blob_service.generate_signed_url(
                blob_path=blob_ref.blob_path,
                expires_in_hours=24,
            )
            timings["blob_sas_generation"] = time.time() - sas_start
            logger.debug(f"Generated SAS URL for transcription blob in {timings['blob_sas_generation']:.2f}s")
            
            # OPTIMIZATION: Skip blob download - use SAS URL directly
            # The transcription service can use SAS URL without local file
            # Only create temp file path as placeholder (transcription_service will handle SAS URL)
            ext = audio_file.filename.split('.')[-1] if '.' in audio_file.filename else 'mp3'
            temp_file_path = None  # Not needed when using SAS URL directly
            
            # Extend message visibility periodically during processing
            async def extend_visibility():
                nonlocal latest_pop_receipt
                while True:
                    await asyncio.sleep(300)  # Every 5 minutes
                    try:
                        new_pop_receipt = await self.queue_service.update_message_visibility(
                            message_id,
                            latest_pop_receipt,
                            visibility_timeout=self.settings.azure_queue.visibility_timeout
                        )
                        logger.debug(f"Extended message visibility: {message_id}")
                        latest_pop_receipt = new_pop_receipt
                    except Exception as e:
                        logger.warning(f"Failed to extend visibility: {e}")
            
            # Start visibility extension task
            visibility_task = asyncio.create_task(extend_visibility())
            heartbeat_task = None  # Initialize for cleanup
            
            try:
                # Create transcription request (use SAS URL, no local file needed)
                request = AudioTranscriptionRequest(
                    patient_id=patient_id,
                    visit_id=visit_id,
                    audio_file_path=None,  # Not needed when sas_url provided
                    language=language,
                    sas_url=sas_url,
                )
                
                # Execute transcription use case
                use_case = TranscribeAudioUseCase(
                    self.patient_repo,
                    self.visit_repo,
                    self.transcription_service
                )
                
                # Process transcription with timeout (this can take 10+ minutes)
                job_create_start = time.time()
                logger.debug(f"Starting transcription processing for visit {visit_id}")
                
                # Add heartbeat logging task to show progress (INFO level for visibility)
                transcription_id_var = None  # Will be updated when we get transcription_id
                async def heartbeat_logger():
                    """Log progress every 60 seconds at INFO level to show worker is still processing."""
                    heartbeat_interval = 60  # 60 seconds
                    while True:
                        await asyncio.sleep(heartbeat_interval)
                        elapsed = time.time() - job_create_start
                        logger.info(
                            f"💓 Transcription heartbeat: visit={visit_id}, "
                            f"transcription_id={transcription_id_var or 'N/A'}, "
                            f"elapsed={elapsed:.1f}s, still processing..."
                        )
                
                heartbeat_task = asyncio.create_task(heartbeat_logger())
                
                # Add timeout for transcription (30 minutes max)
                try:
                    result = await asyncio.wait_for(
                        use_case.execute(request),
                        timeout=1800.0  # 30 minutes
                    )
                except asyncio.TimeoutError:
                    transcription_duration = time.time() - job_create_start
                    total_duration = time.time() - job_start_time
                    error_msg = f"Transcription processing timed out after {transcription_duration:.2f}s"
                    logger.error(f"❌ {error_msg}")
                    raise TimeoutError(error_msg)
                finally:
                    # Cancel heartbeat task when done (success or timeout)
                    if heartbeat_task:
                        heartbeat_task.cancel()
                        try:
                            await heartbeat_task
                        except asyncio.CancelledError:
                            pass
                
                # Track timings: job_create includes all transcription work (speech + LLM + PII removal)
                timings["job_create"] = time.time() - job_create_start
                timings["postprocess"] = timings["job_create"]  # For backward compatibility
                
                # STRICT VALIDATION: Never log "completed" for empty/failed transcripts
                if result.transcription_status != "completed":
                    error_msg = result.message or "Transcription status not completed"
                    logger.error(f"❌ Transcription failed: status={result.transcription_status}, message={error_msg}")
                    raise ValueError(f"Transcription failed: {error_msg}")
                
                if not result.transcript or result.transcript.strip() == "":
                    error_msg = "Transcription returned empty transcript"
                    logger.error(f"❌ {error_msg}")
                    raise ValueError(error_msg)
                
                if result.word_count is None or result.word_count == 0:
                    error_msg = "Transcription returned zero word count"
                    logger.error(f"❌ {error_msg}")
                    raise ValueError(error_msg)
                
                # Update audio file with duration if we have the result
                if result.audio_duration:
                    await self.audio_repo.update_audio_metadata(
                        audio_file_id,
                        duration_seconds=result.audio_duration
                    )
                    logger.debug(f"Updated audio file duration: {result.audio_duration} seconds")
                
                # Delete message from queue (job completed successfully)
                db_save_start = time.time()
                # Message already deleted by use case, but ensure cleanup
                await self.queue_service.delete_message(message_id, latest_pop_receipt)
                timings["db_save"] = time.time() - db_save_start
                
                # Structured success log
                total_duration = time.time() - job_start_time
                log_data = {
                    "event": "transcription_job_completed",
                    "message_id": message_id,
                    "visit_id": visit_id,
                    "audio_file_id": audio_file_id,
                    "retry_count": retry_count,
                    "request_id": request_id,
                    "status": "success",
                    "timings": timings,
                    "total_time_seconds": total_duration,
                    "word_count": result.word_count,
                    "audio_duration": result.audio_duration,
                }
                logger.info(json.dumps(log_data))
                
            finally:
                # Cancel visibility extension task and heartbeat task
                if visibility_task:
                    visibility_task.cancel()
                    try:
                        await visibility_task
                    except asyncio.CancelledError:
                        pass
                if heartbeat_task:
                    heartbeat_task.cancel()
                    try:
                        await heartbeat_task
                    except asyncio.CancelledError:
                        pass
                    
        except Exception as e:
            total_duration = time.time() - job_start_time
            
            # Extract clean error information (no PHI, no __name__ bug)
            error_type = type(e).__name__  # Use type(e).__name__ not e.__name__
            error_message = str(e)
            error_code = getattr(e, 'error_code', 'UNKNOWN_ERROR') if hasattr(e, 'error_code') else 'UNKNOWN_ERROR'
            
            # Avoid double-prefixing error messages
            if error_message.startswith("Transcription failed:"):
                clean_error_message = error_message
            else:
                clean_error_message = f"{error_type}: {error_message}"
            
            logger.error(
                f"❌ Transcription job failed: visit={visit_id}, message_id={message_id}, "
                f"retry={retry_count}, duration={total_duration:.2f}s, "
                f"error_type={error_type}, error_code={error_code}",
                exc_info=True
            )
            
            # Cancel visibility task and heartbeat task if running
            if visibility_task:
                visibility_task.cancel()
            if heartbeat_task:
                heartbeat_task.cancel()
                try:
                    await heartbeat_task
                except asyncio.CancelledError:
                    pass
            
            # Check if this is a permanent error that shouldn't be retried
            from clinicai.domain.errors import VisitNotFoundError
            is_permanent_error = isinstance(e, VisitNotFoundError)
            
            if is_permanent_error:
                # Permanent error - delete message immediately (no retries)
                logger.warning(f"Permanent error detected ({error_type}), not retrying: {clean_error_message}")
                try:
                    await self.queue_service.delete_message(message_id, latest_pop_receipt)
                    logger.info(f"Deleted message {message_id} after permanent error")
                except Exception as delete_error:
                    logger.error(f"Failed to delete message after permanent error: {delete_error}", exc_info=True)
                
                # Structured failure log
                log_data = {
                    "event": "transcription_job_failed",
                    "message_id": message_id,
                    "visit_id": visit_id,
                    "audio_file_id": audio_file_id,
                    "retry_count": retry_count,
                    "request_id": request_id,
                    "status": "failed",
                    "error_type": error_type,
                    "error_code": error_code,
                    "error_message": clean_error_message,
                    "timings": timings,
                    "total_time_seconds": total_duration,
                    "is_permanent": True,
                }
                logger.info(json.dumps(log_data))
                return
            
            # Handle retries for transient errors
            if retry_count < self.settings.azure_queue.max_retry_attempts:
                # Calculate exponential backoff delay
                delay_seconds = min(60 * (2 ** retry_count), 300)  # Max 5 minutes
                new_retry_count = retry_count + 1
                
                # Re-enqueue with incremented retry count and delay
                try:
                    await self.queue_service.enqueue_transcription_job(
                        job_data["patient_id"],
                        job_data["visit_id"],
                        job_data["audio_file_id"],
                        job_data["language"],
                        retry_count=new_retry_count,
                        delay_seconds=delay_seconds,
                        request_id=request_id
                    )
                    logger.info(f"Re-queued job for retry {new_retry_count}/{self.settings.azure_queue.max_retry_attempts} with {delay_seconds}s delay")
                except Exception as requeue_error:
                    logger.error(f"Failed to re-enqueue job: {requeue_error}", exc_info=True)
                
                # CRITICAL: Delete original message AFTER re-enqueue succeeds
                try:
                    await self.queue_service.delete_message(message_id, latest_pop_receipt)
                    logger.debug(f"Deleted original message {message_id} after re-enqueue")
                except Exception as delete_error:
                    logger.error(f"CRITICAL: Failed to delete original message {message_id} after re-enqueue: {delete_error}", exc_info=True)
                    # This could cause duplicates, but better to log than crash
                
                # Structured retry log
                log_data = {
                    "event": "transcription_job_retry",
                    "message_id": message_id,
                    "visit_id": visit_id,
                    "audio_file_id": audio_file_id,
                    "retry_count": retry_count,
                    "new_retry_count": new_retry_count,
                    "request_id": request_id,
                    "status": "retrying",
                    "error_type": error_type,
                    "error_code": error_code,
                    "delay_seconds": delay_seconds,
                    "timings": timings,
                    "total_time_seconds": total_duration,
                }
                logger.info(json.dumps(log_data))
            else:
                # Max retries exceeded - delete message and mark as failed
                try:
                    await self.queue_service.delete_message(message_id, latest_pop_receipt)
                    logger.info(f"Deleted message {message_id} after max retries exceeded")
                except Exception as delete_error:
                    logger.error(f"Failed to delete message after max retries: {delete_error}", exc_info=True)
                
                # Mark visit transcription as failed with clean error message
                try:
                    visit = await self.visit_repo.find_by_patient_and_visit_id(
                        patient_id, VisitId(visit_id)
                    )
                    if visit:
                        # Store structured error info (no PHI)
                        error_info = f"{error_code}: {clean_error_message}"
                        visit.fail_transcription(error_info)
                        await self.visit_repo.save(visit)
                        logger.info(f"Marked transcription as failed for visit {visit_id}")
                except Exception as db_error:
                    logger.error(f"Failed to mark transcription as failed: {db_error}", exc_info=True)
                
                # Structured permanent failure log
                log_data = {
                    "event": "transcription_job_failed",
                    "message_id": message_id,
                    "visit_id": visit_id,
                    "audio_file_id": audio_file_id,
                    "retry_count": retry_count,
                    "request_id": request_id,
                    "status": "failed",
                    "error_type": error_type,
                    "error_code": error_code,
                    "error_message": clean_error_message,
                    "timings": timings,
                    "total_time_seconds": total_duration,
                    "is_permanent": False,
                    "max_retries_exceeded": True,
                }
                logger.info(json.dumps(log_data))
        finally:
            # Clean up temp file (if created)
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                    logger.debug(f"Cleaned up temp file: {temp_file_path}")
                except Exception as cleanup_error:
                    logger.warning(f"Failed to clean up temp file: {cleanup_error}")
    
    async def run(self):
        """Main worker loop with bounded concurrency."""
        # Worker startup guard: check if already running
        worker_process_id = os.getpid()
        logger.info(f"🚀 Starting transcription worker (PID: {worker_process_id})...")
        
        # Check if ENABLE_TRANSCRIPTION_WORKER is set (only warn if both are running)
        if os.getenv("ENABLE_TRANSCRIPTION_WORKER", "false").lower() == "true":
            logger.warning(
                "⚠️  ENABLE_TRANSCRIPTION_WORKER=true detected. "
                "If this worker is running as a separate process, you may have duplicate workers. "
                "Recommended: run worker either in-process (ENABLE_TRANSCRIPTION_WORKER=true) "
                "OR as separate process (worker_startup.py), not both."
            )
        
        await self.initialize()
        
        # Read concurrency from environment (default to 5 for dev, 2 for production)
        default_concurrency = 5  # Increased default for better throughput
        try:
            max_concurrent_jobs = int(os.getenv("TRANSCRIPTION_WORKER_CONCURRENCY", str(default_concurrency)))
        except ValueError:
            max_concurrent_jobs = default_concurrency
        if max_concurrent_jobs < 1:
            max_concurrent_jobs = 1
        
        logger.info(f"Transcription worker concurrency set to {max_concurrent_jobs}")
        semaphore = asyncio.Semaphore(max_concurrent_jobs)
        
        # Track queue polling for observability
        poll_count = 0
        last_queue_status_log = time.time()
        queue_status_log_interval = 300  # Log queue status every 5 minutes

        async def handle_job(job: dict):
            async with semaphore:
                await self.process_job(
                    job["data"],
                    job["message_id"],
                    job["pop_receipt"],
                )
        
        while True:
            try:
                # Poll queue for messages (non-blocking)
                job = await self.queue_service.dequeue_transcription_job()
                poll_count += 1
                
                if job:
                    # Process job in background with concurrency limit
                    asyncio.create_task(handle_job(job))
                else:
                    # No messages, wait before next poll
                    await asyncio.sleep(self.poll_interval)
                
                # Periodic queue status logging (every 5 minutes)
                current_time = time.time()
                if current_time - last_queue_status_log >= queue_status_log_interval:
                    logger.info(
                        f"📊 Worker status: poll_count={poll_count}, "
                        f"concurrent_jobs={max_concurrent_jobs - semaphore._value}, "
                        f"queue_name={self.queue_service.queue_name}"
                    )
                    last_queue_status_log = current_time
                    
            except KeyboardInterrupt:
                logger.info("🛑 Worker stopped by user")
                break
            except Exception as e:
                logger.error(f"❌ Worker error: {e}", exc_info=True)
                await asyncio.sleep(self.poll_interval)


async def main():
    """Entry point for worker process."""
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    worker = TranscriptionWorker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())

