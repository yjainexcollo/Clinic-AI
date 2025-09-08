"""
MongoDB implementation of PatientRepository.
"""

from datetime import datetime
from typing import List, Optional

from clinicai.application.ports.repositories.patient_repo import PatientRepository
from clinicai.domain.entities.patient import Patient
from clinicai.domain.entities.visit import IntakeSession, QuestionAnswer, Visit
from clinicai.domain.value_objects.patient_id import PatientId
from clinicai.domain.value_objects.question_id import QuestionId
from clinicai.domain.value_objects.visit_id import VisitId

from ..models.patient_m import (
    IntakeSessionMongo,
    PatientMongo,
    QuestionAnswerMongo,
    VisitMongo,
)


class MongoPatientRepository(PatientRepository):
    """MongoDB implementation of PatientRepository."""

    async def save(self, patient: Patient) -> Patient:
        """Save a patient to MongoDB."""
        # Convert domain entity to MongoDB model
        patient_mongo = await self._domain_to_mongo(patient)

        # Save to database
        await patient_mongo.save()

        # Return the domain entity
        return await self._mongo_to_domain(patient_mongo)

    async def find_by_id(self, patient_id: PatientId) -> Optional[Patient]:
        """Find a patient by ID."""
        patient_mongo = await PatientMongo.find_one(
            PatientMongo.patient_id == patient_id.value
        )

        if not patient_mongo:
            return None

        return await self._mongo_to_domain(patient_mongo)

    async def find_by_name_and_mobile(
        self, name: str, mobile: str
    ) -> Optional[Patient]:
        """Find a patient by name and mobile number."""
        patient_mongo = await PatientMongo.find_one(
            PatientMongo.name == name, PatientMongo.mobile == mobile
        )

        if not patient_mongo:
            return None

        return await self._mongo_to_domain(patient_mongo)

    async def exists_by_id(self, patient_id: PatientId) -> bool:
        """Check if a patient exists by ID."""
        count = await PatientMongo.find(
            PatientMongo.patient_id == patient_id.value
        ).count()

        return count > 0

    async def find_all(self, limit: int = 100, offset: int = 0) -> List[Patient]:
        """Find all patients with pagination."""
        patients_mongo = await PatientMongo.find().skip(offset).limit(limit).to_list()

        return [
            await self._mongo_to_domain(patient_mongo)
            for patient_mongo in patients_mongo
        ]

    async def find_by_mobile(self, mobile: str) -> List[Patient]:
        """Find all patients with the same mobile number (family members)."""
        patients_mongo = await PatientMongo.find(
            PatientMongo.mobile == mobile
        ).to_list()

        return [
            await self._mongo_to_domain(patient_mongo)
            for patient_mongo in patients_mongo
        ]

    async def delete(self, patient_id: PatientId) -> bool:
        """Delete a patient by ID."""
        result = await PatientMongo.find_one(
            PatientMongo.patient_id == patient_id.value
        ).delete()

        return result is not None

    async def _domain_to_mongo(self, patient: Patient) -> PatientMongo:
        """Convert domain entity to MongoDB model."""
        # Convert visits
        visits_mongo = []
        for visit in patient.visits:
            # Convert intake session
            intake_session_mongo = None
            if visit.intake_session:
                # Convert question answers
                questions_asked_mongo = []
                for qa in visit.intake_session.questions_asked:
                    qa_mongo = QuestionAnswerMongo(
                        question_id=qa.question_id.value,
                        question=qa.question,
                        answer=qa.answer,
                        timestamp=qa.timestamp,
                        question_number=qa.question_number,
                    )
                    questions_asked_mongo.append(qa_mongo)

                intake_session_mongo = IntakeSessionMongo(
                    disease=visit.intake_session.disease,
                    questions_asked=questions_asked_mongo,
                    current_question_count=visit.intake_session.current_question_count,
                    max_questions=visit.intake_session.max_questions,
                    status=visit.intake_session.status,
                    started_at=visit.intake_session.started_at,
                    completed_at=visit.intake_session.completed_at,
                )

            visit_mongo = VisitMongo(
                visit_id=visit.visit_id.value,
                patient_id=visit.patient_id,
                disease=visit.disease,
                status=visit.status,
                created_at=visit.created_at,
                updated_at=visit.updated_at,
                intake_session=intake_session_mongo,
            )
            visits_mongo.append(visit_mongo)

        # Check if patient already exists
        existing_patient = await PatientMongo.find_one(
            PatientMongo.patient_id == patient.patient_id.value
        )

        if existing_patient:
            # Update existing patient
            existing_patient.name = patient.name
            existing_patient.mobile = patient.mobile
            existing_patient.age = patient.age
            existing_patient.visits = visits_mongo
            existing_patient.updated_at = datetime.utcnow()
            return existing_patient
        else:
            # Create new patient
            return PatientMongo(
                patient_id=patient.patient_id.value,
                name=patient.name,
                mobile=patient.mobile,
                age=patient.age,
                visits=visits_mongo,
                created_at=patient.created_at,
                updated_at=patient.updated_at,
            )

    async def _mongo_to_domain(self, patient_mongo: PatientMongo) -> Patient:
        """Convert MongoDB model to domain entity."""
        # Convert visits
        visits = []
        for visit_mongo in patient_mongo.visits:
            # Convert intake session
            intake_session = None
            if visit_mongo.intake_session:
                # Convert question answers
                questions_asked = []
                for qa_mongo in visit_mongo.intake_session.questions_asked:
                    qa = QuestionAnswer(
                        question_id=QuestionId(qa_mongo.question_id),
                        question=qa_mongo.question,
                        answer=qa_mongo.answer,
                        timestamp=qa_mongo.timestamp,
                        question_number=qa_mongo.question_number,
                    )
                    questions_asked.append(qa)

                intake_session = IntakeSession(
                    disease=visit_mongo.intake_session.disease,
                    questions_asked=questions_asked,
                    current_question_count=visit_mongo.intake_session.current_question_count,
                    max_questions=visit_mongo.intake_session.max_questions,
                    status=visit_mongo.intake_session.status,
                    started_at=visit_mongo.intake_session.started_at,
                    completed_at=visit_mongo.intake_session.completed_at,
                )

            visit = Visit(
                visit_id=VisitId(visit_mongo.visit_id),
                patient_id=visit_mongo.patient_id,
                disease=visit_mongo.disease,
                status=visit_mongo.status,
                created_at=visit_mongo.created_at,
                updated_at=visit_mongo.updated_at,
                intake_session=intake_session,
            )
            visits.append(visit)

        return Patient(
            patient_id=PatientId(patient_mongo.patient_id),
            name=patient_mongo.name,
            mobile=patient_mongo.mobile,
            age=patient_mongo.age,
            visits=visits,
            created_at=patient_mongo.created_at,
            updated_at=patient_mongo.updated_at,
        )
