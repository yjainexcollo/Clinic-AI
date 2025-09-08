"""Register Patient use case for Step-01 functionality.

Formatting-only changes; behavior preserved.
"""

# Unused imports removed

from ...domain.entities.patient import Patient
from ...domain.entities.visit import Visit
from ...domain.errors import DuplicatePatientError

# Domain events currently not dispatched here; keeping behavior unchanged.
from ...domain.value_objects.patient_id import PatientId
from ...domain.value_objects.visit_id import VisitId
from ..dto.patient_dto import RegisterPatientRequest, RegisterPatientResponse
from ..ports.repositories.patient_repo import PatientRepository
from ..ports.services.question_service import QuestionService


class RegisterPatientUseCase:
    """Use case for registering a new patient and starting intake."""

    def __init__(
        self, patient_repository: PatientRepository, question_service: QuestionService
    ):
        self._patient_repository = patient_repository
        self._question_service = question_service

    async def execute(self, request: RegisterPatientRequest) -> RegisterPatientResponse:
        """Execute the register patient use case."""
        # Accept any disease/complaint; trim whitespace
        request.disease = request.disease.strip() if request.disease else ""

        # Generate patient ID
        patient_id = PatientId.generate(request.name, request.mobile)

        # Check if patient already exists (exact match)
        existing_patient = await self._patient_repository.find_by_name_and_mobile(
            request.name, request.mobile
        )
        if existing_patient:
            raise DuplicatePatientError(patient_id.value)

        # Check for family members (mobile-only match) for analytics
        family_members = await self._patient_repository.find_by_mobile(request.mobile)  # noqa: F841
        # Note: We don't prevent registration here, just log for analytics
        # The frontend should handle family member detection via resolve endpoint

        # Create patient entity
        patient = Patient(
            patient_id=patient_id,
            name=request.name,
            mobile=request.mobile,
            age=request.age,
        )

        # Generate visit ID
        visit_id = VisitId.generate()

        # Create visit entity
        visit = Visit(
            visit_id=visit_id, patient_id=patient_id.value, disease=request.disease
        )

        # Generate first question
        first_question = await self._question_service.generate_first_question(
            request.disease
        )

        # Add visit to patient
        patient.add_visit(visit)

        # Save patient (which includes the visit)
        await self._patient_repository.save(patient)

        # Raise domain events
        # Note: In a real implementation, you'd have an event bus
        # For now, we'll just log or handle events directly

        return RegisterPatientResponse(
            patient_id=patient_id.value,
            visit_id=visit_id.value,
            first_question=first_question,
            message="Patient registered successfully. Intake session started.",
        )
