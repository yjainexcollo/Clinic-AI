"""
FastAPI application factory and main app configuration.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.routers import health, patients, notes, prescriptions
from .core.config import get_settings
from .domain.errors import DomainError


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    settings = get_settings()
    print(f"🚀 Starting Clinic-AI Intake Assistant v{settings.app_version}")
    print(f"📊 Environment: {settings.app_env}")
    print(f"🔧 Debug mode: {settings.debug}")
    # Initialize database connection (MongoDB + Beanie)
    try:
        from beanie import init_beanie  # type: ignore
        from motor.motor_asyncio import AsyncIOMotorClient  # type: ignore

        # Import models for registration
        from .adapters.db.mongo.models.patient_m import (
            IntakeSessionMongo,
            PatientMongo,
            QuestionAnswerMongo,
            VisitMongo,
            TranscriptionSessionMongo,
            SoapNoteMongo,
        )
        from .adapters.db.mongo.models.stable_patient_m import (
            IdempotencyRecordMongo,
            IntakeSnapshotMongo,
            StablePatientMongo,
            StableVisitMongo,
            VisitSummaryMongo,
        )

        # Use configured URI and fail fast in dev with shorter selection timeout
        mongo_uri = settings.database.uri
        db_name = settings.database.db_name
        client = AsyncIOMotorClient(mongo_uri, serverSelectionTimeoutMS=5000)
        db = client[db_name]
        await init_beanie(
            database=db,
            document_models=[
                # Patient models
                PatientMongo,
                VisitMongo,
                IntakeSessionMongo,
                QuestionAnswerMongo,
                TranscriptionSessionMongo,
                SoapNoteMongo,
                # Stable patient models
                StablePatientMongo,
                StableVisitMongo,
                IntakeSnapshotMongo,
                VisitSummaryMongo,
                IdempotencyRecordMongo,
            ],
        )
        print("✅ Database connection established")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        raise

    yield

    # Shutdown
    print("🛑 Shutting down Clinic-AI Intake Assistant")


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="Clinic-AI Intake Assistant",
        description="AI-powered clinical intake system for small and mid-sized clinics",
        version=settings.app_version,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        lifespan=lifespan,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors.allowed_origins,
        allow_credentials=settings.cors.allow_credentials,
        allow_methods=settings.cors.allowed_methods,
        allow_headers=settings.cors.allowed_headers,
    )

    # Include routers
    app.include_router(health.router)
    app.include_router(patients.router)
    app.include_router(notes.router)
    app.include_router(prescriptions.router)

    # Global exception handler for domain errors
    @app.exception_handler(DomainError)
    async def domain_error_handler(request, exc: DomainError):
        return JSONResponse(
            status_code=400,
            content={
                "error": exc.error_code or "DOMAIN_ERROR",
                "message": exc.message,
                "details": exc.details,
            },
        )

    # Global exception handler for validation errors
    @app.exception_handler(ValueError)
    async def validation_error_handler(request, exc: ValueError):
        return JSONResponse(
            status_code=422,
            content={"error": "VALIDATION_ERROR", "message": str(exc), "details": {}},
        )

    return app


# Create the app instance
app = create_app()


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information."""
    settings = get_settings()
    return {
        "service": "Clinic-AI Intake Assistant",
        "version": settings.app_version,
        "environment": settings.app_env,
        "status": "running",
        "docs": "/docs" if settings.debug else "disabled",
        "endpoints": {
            "health": "/health",
            "register_patient": "POST /patients/",
            "answer_intake": "POST /patients/consultations/answer",
            "pre_visit_summary": "POST /patients/summary/previsit",
            "get_summary": "GET /patients/{patient_id}/visits/{visit_id}/summary",
            # Step-03 endpoints
            "transcribe_audio": "POST /notes/transcribe",
            "generate_soap": "POST /notes/soap/generate",
            "get_transcript": "GET /notes/{patient_id}/visits/{visit_id}/transcript",
            "get_soap": "GET /notes/{patient_id}/visits/{visit_id}/soap",
            # Prescription endpoints
            "upload_prescriptions": "POST /prescriptions/upload",
        },
    }