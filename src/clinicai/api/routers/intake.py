"""Intake-related API endpoints for repeat intake logic."""

from fastapi import APIRouter, HTTPException, status

from clinicai.application.dto.intake_dto import (
    IntakeStartRequest as IntakeStartRequestDTO,
)
from clinicai.application.dto.intake_dto import (
    IntakeSubmitRequest as IntakeSubmitRequestDTO,
)
from clinicai.application.dto.intake_dto import VisitHistoryRequest
from clinicai.application.use_cases.get_visit_history import GetVisitHistoryUseCase
from clinicai.application.use_cases.start_intake import StartIntakeUseCase
from clinicai.application.use_cases.submit_intake import SubmitIntakeUseCase

from ..deps import StablePatientRepositoryDep
from ..schemas.intake import (
    ErrorResponse,
    IntakeStartRequest,
    IntakeStartResponse,
    IntakeSubmitRequest,
    IntakeSubmitResponse,
    VisitHistoryResponse,
)

router = APIRouter(prefix="/intake", tags=["intake"])


@router.post(
    "/start",
    response_model=IntakeStartResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse, "description": "Validation error"},
        422: {
            "model": ErrorResponse,
            "description": "Invalid phone or OTP not verified",
        },
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def start_intake(
    request: IntakeStartRequest,
    patient_repo: StablePatientRepositoryDep,
):
    """
    Start an intake session with patient matching logic.

    This endpoint:
    1. Validates OTP verification for phone
    2. Normalizes name and phone for matching
    3. Finds existing patient or creates new one
    4. Creates new visit for the patient
    5. Handles idempotency for repeat submissions
    6. Returns patient_id and visit_id for intake
    """
    try:
        # Convert Pydantic model to DTO
        dto_request = IntakeStartRequestDTO(
            name=request.name,
            phone=request.phone,
            age=request.age,
            patient_id_hint=request.patient_id_hint,
            idempotency_key=request.idempotency_key,
            otp_verified=request.otp_verified,
        )

        # Execute use case
        use_case = StartIntakeUseCase(patient_repo)
        result = await use_case.execute(dto_request)

        return IntakeStartResponse(
            action=result.action,
            patient_id=result.patient_id,
            visit_id=result.visit_id,
            message=result.message,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "VALIDATION_ERROR",
                "message": str(e),
                "details": {},
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": {"exception": str(e)},
            },
        )


@router.post(
    "/submit",
    response_model=IntakeSubmitResponse,
    status_code=status.HTTP_200_OK,
    responses={
        400: {"model": ErrorResponse, "description": "Validation error"},
        404: {"model": ErrorResponse, "description": "Visit not found"},
        422: {"model": ErrorResponse, "description": "Invalid visit or patient"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def submit_intake(
    request: IntakeSubmitRequest,
    patient_repo: StablePatientRepositoryDep,
):
    """
    Submit intake answers for a specific visit.

    This endpoint:
    1. Validates the visit exists
    2. Validates visit belongs to specified patient
    3. Updates visit with intake answers
    4. Returns updated visit status
    """
    try:
        # Convert Pydantic model to DTO
        dto_request = IntakeSubmitRequestDTO(
            patient_id=request.patient_id,
            visit_id=request.visit_id,
            answers=request.answers,
        )

        # Execute use case
        use_case = SubmitIntakeUseCase(patient_repo)
        result = await use_case.execute(dto_request)

        return IntakeSubmitResponse(
            visit_id=result.visit_id,
            status=result.status,
            total_questions=result.total_questions,
            message=result.message,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "VALIDATION_ERROR",
                "message": str(e),
                "details": {},
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": {"exception": str(e)},
            },
        )


@router.get(
    "/patients/{patient_id}/visits",
    response_model=VisitHistoryResponse,
    status_code=status.HTTP_200_OK,
    responses={
        400: {"model": ErrorResponse, "description": "Validation error"},
        404: {"model": ErrorResponse, "description": "Patient not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def get_visit_history(
    patient_id: str,
    patient_repo: StablePatientRepositoryDep,
    limit: int = 100,
    offset: int = 0,
):
    """
    Get patient visit history.

    This endpoint:
    1. Validates patient exists
    2. Returns chronological visit history
    3. Supports pagination with limit/offset
    """
    try:
        # Create request DTO
        request = VisitHistoryRequest(
            patient_id=patient_id,
            limit=limit,
            offset=offset,
        )

        # Execute use case
        use_case = GetVisitHistoryUseCase(patient_repo)
        result = await use_case.execute(request)

        return VisitHistoryResponse(
            patient_id=result.patient_id,
            total_visits=result.total_visits,
            visits=[
                {
                    "visit_id": visit.visit_id,
                    "status": visit.status,
                    "created_at": visit.created_at,
                    "completed_at": visit.completed_at,
                    "total_questions": visit.total_questions,
                    "intake_duration_seconds": visit.intake_duration_seconds,
                }
                for visit in result.visits
            ],
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "PATIENT_NOT_FOUND",
                "message": str(e),
                "details": {},
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": {"exception": str(e)},
            },
        )
