"""Submit Intake use case for repeat intake logic."""

from ...domain.value_objects.stable_visit_id import StableVisitId
from ..dto.intake_dto import IntakeSubmitRequest, IntakeSubmitResponse
from ..ports.repositories.stable_patient_repo import StablePatientRepository


class SubmitIntakeUseCase:
    """Use case for submitting intake answers for a specific visit."""

    def __init__(self, patient_repository: StablePatientRepository):
        self._patient_repository = patient_repository

    async def execute(self, request: IntakeSubmitRequest) -> IntakeSubmitResponse:
        """Execute the submit intake use case."""
        # Find the visit
        visit_id = StableVisitId.from_string(request.visit_id)
        visit = await self._patient_repository.find_visit_by_id(visit_id)

        if not visit:
            raise ValueError(f"Visit not found: {request.visit_id}")

        # Validate visit belongs to the specified patient
        if visit.patient_id != request.patient_id:
            raise ValueError("Visit does not belong to the specified patient")

        # Submit intake answers
        visit.submit_intake_answers(request.answers)

        # Update visit in repository
        updated_visit = await self._patient_repository.update_visit(visit)

        return IntakeSubmitResponse(
            visit_id=updated_visit.visit_id.value,
            status=updated_visit.status,
            total_questions=(
                updated_visit.intake_snapshot.total_questions
                if updated_visit.intake_snapshot
                else 0
            ),
            message="Intake answers submitted successfully.",
        )
