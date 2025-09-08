"""Resolve Patient use case for smart patient resolution.

Handles:
- Exact match (returning patient)
- Mobile-only match (family members)
- New patient creation
"""

from ...domain.errors import InvalidDiseaseError
from ..dto.patient_dto import PatientResolutionResult, ResolvePatientRequest
from ..ports.repositories.patient_repo import PatientRepository


class ResolvePatientUseCase:
    """Use case for resolving patient identity and determining next action."""

    def __init__(self, patient_repository: PatientRepository):
        self._patient_repository = patient_repository

    async def execute(self, request: ResolvePatientRequest) -> PatientResolutionResult:
        """Execute the patient resolution use case."""
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
            raise InvalidDiseaseError(request.disease)

        # Step 1: Check for exact match (name + mobile)
        exact_patient = await self._patient_repository.find_by_name_and_mobile(
            request.name, request.mobile
        )
        if exact_patient:
            return PatientResolutionResult(
                patient=exact_patient,
                resolution_type="exact_match",
                action="continue_existing",
                message="Returning patient found. Continue with existing profile.",
            )

        # Step 2: Check for mobile-only match (family members)
        mobile_patients = await self._patient_repository.find_by_mobile(request.mobile)
        if mobile_patients:
            return PatientResolutionResult(
                candidates=mobile_patients,
                resolution_type="mobile_match",
                action="select_or_create",
                message=(
                    f"Found {len(mobile_patients)} existing patient(s) with this"
                    " mobile number. Please select or create new."
                ),
            )

        # Step 3: No match - new patient
        return PatientResolutionResult(
            resolution_type="new_patient",
            action="create_new",
            message="No existing patient found. Proceed with new patient registration.",
        )
