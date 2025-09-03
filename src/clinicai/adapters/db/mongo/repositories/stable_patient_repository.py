"""MongoDB implementation of StablePatientRepository for repeat intake logic."""

from datetime import datetime, timedelta
from typing import List, Optional, Tuple

from clinicai.application.ports.repositories.stable_patient_repo import StablePatientRepository
from clinicai.domain.entities.stable_patient import StablePatient
from clinicai.domain.entities.stable_visit import IntakeSnapshot, StableVisit, VisitSummary
from clinicai.domain.value_objects.stable_patient_id import StablePatientId
from clinicai.domain.value_objects.stable_visit_id import StableVisitId
from clinicai.domain.value_objects.idempotency_key import IdempotencyKey
from clinicai.core.utils.patient_matching import normalize_name, normalize_phone

from ..models.stable_patient_m import (
    IdempotencyRecordMongo,
    IntakeSnapshotMongo,
    StablePatientMongo,
    StableVisitMongo,
    VisitSummaryMongo,
)


class MongoStablePatientRepository(StablePatientRepository):
    """MongoDB implementation of StablePatientRepository."""

    async def save_patient(self, patient: StablePatient) -> StablePatient:
        """Save a patient to MongoDB."""
        patient_mongo = await self._domain_to_mongo_patient(patient)
        await patient_mongo.save()
        return await self._mongo_to_domain_patient(patient_mongo)

    async def find_patient_by_id(self, patient_id: StablePatientId) -> Optional[StablePatient]:
        """Find a patient by ID."""
        patient_mongo = await StablePatientMongo.find_one(
            StablePatientMongo.patient_id == patient_id.value
        )
        if not patient_mongo:
            return None
        return await self._mongo_to_domain_patient(patient_mongo)

    async def find_patient_by_normalized_data(
        self, name_normalized: str, phone_normalized: str
    ) -> Optional[StablePatient]:
        """Find a patient by normalized name and phone."""
        patient_mongo = await StablePatientMongo.find_one(
            StablePatientMongo.name_normalized == name_normalized,
            StablePatientMongo.phone_normalized == phone_normalized
        )
        if not patient_mongo:
            return None
        return await self._mongo_to_domain_patient(patient_mongo)

    async def find_or_create_patient(
        self, name: str, phone_e164: str, age: Optional[int] = None
    ) -> Tuple[StablePatient, bool]:
        """
        Find existing patient or create new one atomically.
        
        Returns:
            Tuple of (patient, is_new_patient)
        """
        name_normalized = normalize_name(name)
        phone_normalized = normalize_phone(phone_e164)
        
        # Try to find existing patient
        existing_patient = await self.find_patient_by_normalized_data(
            name_normalized, phone_normalized
        )
        
        if existing_patient:
            return existing_patient, False
        
        # Create new patient
        patient_id = StablePatientId.generate()
        new_patient = StablePatient(
            patient_id=patient_id,
            name=name,
            phone_e164=phone_e164,
            age=age
        )
        
        saved_patient = await self.save_patient(new_patient)
        return saved_patient, True

    async def add_visit_to_patient(
        self, patient_id: StablePatientId, visit: StableVisit
    ) -> StableVisit:
        """Add a visit to an existing patient atomically."""
        # Use findOneAndUpdate for atomic operation
        visit_mongo = await self._domain_to_mongo_visit(visit)
        
        # Add visit to patient's visits array atomically
        result = await StablePatientMongo.find_one(
            StablePatientMongo.patient_id == patient_id.value
        ).update(
            {"$push": {"visits": visit_mongo.dict()}, "$set": {"updated_at": datetime.utcnow()}}
        )
        
        if not result:
            raise ValueError(f"Patient not found: {patient_id.value}")
        
        return visit

    async def get_patient_visits(
        self, patient_id: StablePatientId, limit: int = 100, offset: int = 0
    ) -> List[StableVisit]:
        """Get patient's visit history."""
        patient_mongo = await StablePatientMongo.find_one(
            StablePatientMongo.patient_id == patient_id.value
        )
        if not patient_mongo:
            return []
        
        # Sort visits by created_at descending and apply pagination
        visits = sorted(patient_mongo.visits, key=lambda v: v.created_at, reverse=True)
        paginated_visits = visits[offset:offset + limit]
        
        return [await self._mongo_to_domain_visit(visit) for visit in paginated_visits]

    async def find_visit_by_id(self, visit_id: StableVisitId) -> Optional[StableVisit]:
        """Find a visit by ID."""
        # Since visits are embedded in patient documents, we need to search through patients
        patient_mongo = await StablePatientMongo.find_one(
            {"visits.visit_id": visit_id.value}
        )
        if not patient_mongo:
            return None
        
        # Find the specific visit in the patient's visits
        for visit_mongo in patient_mongo.visits:
            if visit_mongo.visit_id == visit_id.value:
                return await self._mongo_to_domain_visit(visit_mongo)
        
        return None

    async def update_visit(self, visit: StableVisit) -> StableVisit:
        """Update a visit."""
        # Find the patient that contains this visit
        patient_mongo = await StablePatientMongo.find_one(
            {"visits.visit_id": visit.visit_id.value}
        )
        if not patient_mongo:
            raise ValueError(f"Patient not found for visit: {visit.visit_id.value}")
        
        # Update the specific visit in the patient's visits array
        for i, visit_mongo in enumerate(patient_mongo.visits):
            if visit_mongo.visit_id == visit.visit_id.value:
                # Convert domain visit to mongo and update
                updated_visit_mongo = await self._domain_to_mongo_visit(visit)
                patient_mongo.visits[i] = updated_visit_mongo
                break
        
        # Save the updated patient document
        await patient_mongo.save()
        return visit

    async def save_idempotency_record(
        self, 
        idempotency_key: IdempotencyKey,
        patient_id: StablePatientId,
        visit_id: StableVisitId
    ) -> None:
        """Save an idempotency record."""
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        
        record = IdempotencyRecordMongo(
            idempotency_key=idempotency_key.value,
            patient_id=patient_id.value,
            visit_id=visit_id.value,
            expires_at=expires_at
        )
        await record.save()

    async def find_idempotency_record(
        self, idempotency_key: IdempotencyKey
    ) -> Optional[Tuple[StablePatientId, StableVisitId]]:
        """Find an idempotency record."""
        record = await IdempotencyRecordMongo.find_one(
            IdempotencyRecordMongo.idempotency_key == idempotency_key.value,
            IdempotencyRecordMongo.expires_at > datetime.utcnow()
        )
        
        if not record:
            return None
        
        return (
            StablePatientId.from_string(record.patient_id),
            StableVisitId.from_string(record.visit_id)
        )

    async def cleanup_expired_idempotency_records(self) -> int:
        """Clean up expired idempotency records."""
        result = await IdempotencyRecordMongo.find(
            IdempotencyRecordMongo.expires_at <= datetime.utcnow()
        ).delete()
        return result.deleted_count

    # Helper methods for domain <-> mongo conversion

    async def _domain_to_mongo_patient(self, patient: StablePatient) -> StablePatientMongo:
        """Convert domain patient to MongoDB model."""
        visits_mongo = []
        for visit in patient.visits:
            visits_mongo.append(await self._domain_to_mongo_visit(visit))
        
        return StablePatientMongo(
            patient_id=patient.patient_id.value,
            name=patient.name,
            phone_e164=patient.phone_e164,
            age=patient.age,
            gender=patient.gender,
            date_of_birth=patient.date_of_birth,
            name_normalized=patient.name_normalized,
            phone_normalized=patient.phone_normalized,
            visits=visits_mongo,
            created_at=patient.created_at,
            updated_at=patient.updated_at
        )

    async def _mongo_to_domain_patient(self, patient_mongo: StablePatientMongo) -> StablePatient:
        """Convert MongoDB model to domain patient."""
        visits = []
        for visit_mongo in patient_mongo.visits:
            visits.append(await self._mongo_to_domain_visit(visit_mongo))
        
        return StablePatient(
            patient_id=StablePatientId.from_string(patient_mongo.patient_id),
            name=patient_mongo.name,
            phone_e164=patient_mongo.phone_e164,
            age=patient_mongo.age,
            gender=patient_mongo.gender,
            date_of_birth=patient_mongo.date_of_birth,
            visits=visits,
            created_at=patient_mongo.created_at,
            updated_at=patient_mongo.updated_at
        )

    async def _domain_to_mongo_visit(self, visit: StableVisit) -> StableVisitMongo:
        """Convert domain visit to MongoDB model."""
        intake_snapshot_mongo = None
        if visit.intake_snapshot:
            intake_snapshot_mongo = IntakeSnapshotMongo(
                answers=visit.intake_snapshot.answers,
                completed_at=visit.intake_snapshot.completed_at,
                total_questions=visit.intake_snapshot.total_questions,
                intake_duration_seconds=visit.intake_snapshot.intake_duration_seconds
            )
        
        summaries_mongo = []
        for summary in visit.summaries:
            summaries_mongo.append(VisitSummaryMongo(
                chief_complaint=summary.chief_complaint,
                symptoms=summary.symptoms,
                diagnosis=summary.diagnosis,
                treatment_plan=summary.treatment_plan,
                notes=summary.notes
            ))
        
        return StableVisitMongo(
            visit_id=visit.visit_id.value,
            patient_id=visit.patient_id,
            status=visit.status,
            created_at=visit.created_at,
            updated_at=visit.updated_at,
            intake_snapshot=intake_snapshot_mongo,
            summaries=summaries_mongo,
            notes=visit.notes,
            idempotency_key=visit.idempotency_key.value if visit.idempotency_key else None
        )

    async def _mongo_to_domain_visit(self, visit_mongo: StableVisitMongo) -> StableVisit:
        """Convert MongoDB model to domain visit."""
        intake_snapshot = None
        if visit_mongo.intake_snapshot:
            intake_snapshot = IntakeSnapshot(
                answers=visit_mongo.intake_snapshot.answers,
                completed_at=visit_mongo.intake_snapshot.completed_at,
                total_questions=visit_mongo.intake_snapshot.total_questions,
                intake_duration_seconds=visit_mongo.intake_snapshot.intake_duration_seconds
            )
        
        summaries = []
        for summary_mongo in visit_mongo.summaries:
            summaries.append(VisitSummary(
                chief_complaint=summary_mongo.chief_complaint,
                symptoms=summary_mongo.symptoms,
                diagnosis=summary_mongo.diagnosis,
                treatment_plan=summary_mongo.treatment_plan,
                notes=summary_mongo.notes
            ))
        
        return StableVisit(
            visit_id=StableVisitId.from_string(visit_mongo.visit_id),
            patient_id=visit_mongo.patient_id,
            status=visit_mongo.status,
            created_at=visit_mongo.created_at,
            updated_at=visit_mongo.updated_at,
            intake_snapshot=intake_snapshot,
            summaries=summaries,
            notes=visit_mongo.notes,
            idempotency_key=IdempotencyKey.from_string(visit_mongo.idempotency_key) if visit_mongo.idempotency_key else None
        )
