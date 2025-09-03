"""Start Visit for Existing Patient use case.

Creates a new visit for an existing patient.
"""

from ...domain.entities.visit import Visit
from ...domain.errors import PatientNotFoundError
from ...domain.value_objects.patient_id import PatientId
from ...domain.value_objects.visit_id import VisitId
from ..dto.patient_dto import FamilyMemberSelectionRequest, FamilyMemberSelectionResponse
from ..ports.repositories.patient_repo import PatientRepository
from ..ports.services.question_service import QuestionService


class StartVisitForPatientUseCase:
    """Use case for starting a new visit for an existing patient."""

    def __init__(
        self, patient_repository: PatientRepository, question_service: QuestionService
    ):
        self._patient_repository = patient_repository
        self._question_service = question_service

    async def execute(
        self, request: FamilyMemberSelectionRequest
    ) -> FamilyMemberSelectionResponse:
        """Execute the start visit for patient use case."""
        # Validate disease
        valid_diseases = [
            "Hypertension",
            "Diabetes",
            "Chest Pain",
            "Fever",
            "Cough",
            "Headache",
            "Back Pain",
        ]
        if request.disease not in valid_diseases:
            raise ValueError(f"Invalid disease: {request.disease}")

        # Find the patient
        patient_id = PatientId(request.selected_patient_id)
        patient = await self._patient_repository.find_by_id(patient_id)
        if not patient:
            raise PatientNotFoundError(patient_id.value)

        # Generate visit ID
        visit_id = VisitId.generate()

        # Create visit entity
        visit = Visit(
            visit_id=visit_id,
            patient_id=patient_id.value,
            disease=request.disease,
        )

        # Generate first question
        first_question = await self._question_service.generate_first_question(
            request.disease
        )

        # Add visit to patient
        patient.add_visit(visit)

        # Save patient (which includes the visit)
        await self._patient_repository.save(patient)

        return FamilyMemberSelectionResponse(
            patient_id=patient_id.value,
            visit_id=visit_id.value,
            first_question=first_question,
            message="New visit started for existing patient. Intake session started.",
        )
