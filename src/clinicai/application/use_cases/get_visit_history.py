"""Get Visit History use case for repeat intake logic."""

from ...domain.value_objects.stable_patient_id import StablePatientId
from ..dto.intake_dto import VisitHistoryRequest, VisitHistoryResponse, VisitSummaryDTO
from ..ports.repositories.stable_patient_repo import StablePatientRepository


class GetVisitHistoryUseCase:
    """Use case for getting patient visit history."""

    def __init__(self, patient_repository: StablePatientRepository):
        self._patient_repository = patient_repository

    async def execute(self, request: VisitHistoryRequest) -> VisitHistoryResponse:
        """Execute the get visit history use case."""
        # Find the patient
        patient_id = StablePatientId.from_string(request.patient_id)
        patient = await self._patient_repository.find_patient_by_id(patient_id)
        
        if not patient:
            raise ValueError(f"Patient not found: {request.patient_id}")

        # Get visit history
        visits = await self._patient_repository.get_patient_visits(
            patient_id, 
            limit=request.limit, 
            offset=request.offset
        )

        # Convert visits to DTOs
        visit_summaries = []
        for visit in visits:
            intake_duration = None
            if visit.intake_snapshot and visit.intake_snapshot.intake_duration_seconds:
                intake_duration = visit.intake_snapshot.intake_duration_seconds

            visit_summaries.append(VisitSummaryDTO(
                visit_id=visit.visit_id.value,
                status=visit.status,
                created_at=visit.created_at.isoformat(),
                completed_at=(
                    visit.intake_snapshot.completed_at.isoformat()
                    if visit.intake_snapshot and visit.intake_snapshot.completed_at
                    else None
                ),
                total_questions=visit.intake_snapshot.total_questions if visit.intake_snapshot else 0,
                intake_duration_seconds=intake_duration
            ))

        return VisitHistoryResponse(
            patient_id=patient.patient_id.value,
            total_visits=len(patient.visits),
            visits=visit_summaries
        )
