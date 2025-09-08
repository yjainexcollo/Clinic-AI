"""Start Intake use case for repeat intake logic."""

from ...core.utils.patient_matching import normalize_phone, validate_phone_otp_verified
from ...domain.entities.stable_visit import StableVisit
from ...domain.value_objects.idempotency_key import IdempotencyKey
from ...domain.value_objects.stable_visit_id import StableVisitId
from ..dto.intake_dto import IntakeStartRequest, IntakeStartResponse
from ..ports.repositories.stable_patient_repo import StablePatientRepository


class StartIntakeUseCase:
    """Use case for starting an intake session with patient matching logic."""

    def __init__(self, patient_repository: StablePatientRepository):
        self._patient_repository = patient_repository

    async def execute(self, request: IntakeStartRequest) -> IntakeStartResponse:
        """Execute the start intake use case."""
        # Validate OTP verification
        if not validate_phone_otp_verified(request.phone, request.otp_verified):
            raise ValueError("Phone number must be OTP verified")

        # Normalize phone to E.164 format
        phone_e164 = normalize_phone(request.phone)
        if not phone_e164:
            raise ValueError("Invalid phone number format")

        # Check for idempotency
        if request.idempotency_key:
            idempotency_key = IdempotencyKey.from_string(request.idempotency_key)
            existing_record = await self._patient_repository.find_idempotency_record(
                idempotency_key
            )
            if existing_record:
                patient_id, visit_id = existing_record
                return IntakeStartResponse(
                    action="existing_patient_new_visit",
                    patient_id=patient_id.value,
                    visit_id=visit_id.value,
                    message="Visit created. Continue intake for this visit only.",
                )

        # Find or create patient
        patient, is_new_patient = await self._patient_repository.find_or_create_patient(
            name=request.name, phone_e164=phone_e164, age=request.age
        )

        # Create new visit
        visit_id = StableVisitId.generate()
        visit = StableVisit(
            visit_id=visit_id, patient_id=patient.patient_id.value, status="open"
        )

        # Set idempotency key if provided
        if request.idempotency_key:
            visit.idempotency_key = IdempotencyKey.from_string(request.idempotency_key)

        # Add visit to patient atomically
        await self._patient_repository.add_visit_to_patient(patient.patient_id, visit)

        # Save idempotency record if provided
        if request.idempotency_key:
            await self._patient_repository.save_idempotency_record(
                visit.idempotency_key, patient.patient_id, visit.visit_id
            )

        # Determine action type
        action = (
            "new_patient_created" if is_new_patient else "existing_patient_new_visit"
        )

        return IntakeStartResponse(
            action=action,
            patient_id=patient.patient_id.value,
            visit_id=visit.visit_id.value,
            message="Visit created. Continue intake for this visit only.",
        )
