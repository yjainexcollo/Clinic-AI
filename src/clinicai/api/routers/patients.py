"""Patient-related API endpoints.

Formatting-only changes; behavior preserved.
"""

from fastapi import APIRouter, HTTPException, status

from clinicai.application.dto.patient_dto import (
    AnswerIntakeRequest,
    FamilyMemberSelectionRequest,
    RegisterPatientRequest,
    ResolvePatientRequest,
)
from clinicai.application.use_cases.answer_intake import AnswerIntakeUseCase
from clinicai.application.use_cases.register_patient import RegisterPatientUseCase
from clinicai.application.use_cases.resolve_patient import ResolvePatientUseCase
from clinicai.application.use_cases.start_visit_for_patient import StartVisitForPatientUseCase
from clinicai.domain.errors import (
    DuplicatePatientError,
    DuplicateQuestionError,
    IntakeAlreadyCompletedError,
    InvalidDiseaseError,
    PatientNotFoundError,
    QuestionLimitExceededError,
    VisitNotFoundError,
)

from ..deps import PatientRepositoryDep, QuestionServiceDep
from ..schemas.patient import (
    AnswerIntakeResponse,
    ErrorResponse,
    FamilyMemberSelectionRequest as FamilyMemberSelectionRequestSchema,
    FamilyMemberSelectionResponse,
    PatientCandidateSchema,
    PatientSummarySchema,
    RegisterPatientResponse,
    ResolvePatientRequest as ResolvePatientRequestSchema,
    ResolvePatientResponse,
)

router = APIRouter(prefix="/patients", tags=["patients"])


@router.post(
    "/",
    response_model=RegisterPatientResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse, "description": "Validation error"},
        409: {"model": ErrorResponse, "description": "Duplicate patient"},
        422: {"model": ErrorResponse, "description": "Invalid disease"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def register_patient(
    request: RegisterPatientRequest,
    patient_repo: PatientRepositoryDep,
    question_service: QuestionServiceDep,
):
    """
    Register a new patient and start intake session.

    This endpoint:
    1. Validates patient data
    2. Generates patient_id and visit_id
    3. Creates patient and visit entities
    4. Generates first question based on disease
    5. Returns patient_id, visit_id, and first question
    """
    try:
        # Convert Pydantic model to DTO
        dto_request = RegisterPatientRequest(
            name=request.name,
            mobile=request.mobile,
            age=request.age,
            disease=request.disease,
        )

        # Execute use case
        use_case = RegisterPatientUseCase(patient_repo, question_service)
        result = await use_case.execute(dto_request)

        return RegisterPatientResponse(
            patient_id=result.patient_id,
            visit_id=result.visit_id,
            first_question=result.first_question,
            message=result.message,
        )

    except DuplicatePatientError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "DUPLICATE_PATIENT",
                "message": e.message,
                "details": e.details,
            },
        )
    except InvalidDiseaseError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "INVALID_DISEASE",
                "message": e.message,
                "details": e.details,
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
    "/consultations/answer",
    response_model=AnswerIntakeResponse,
    status_code=status.HTTP_200_OK,
    responses={
        400: {"model": ErrorResponse, "description": "Validation error"},
        404: {"model": ErrorResponse, "description": "Patient or visit not found"},
        409: {"model": ErrorResponse, "description": "Intake already completed"},
        422: {
            "model": ErrorResponse,
            "description": "Question limit exceeded or duplicate question",
        },
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def answer_intake_question(
    request: AnswerIntakeRequest,
    patient_repo: PatientRepositoryDep,
    question_service: QuestionServiceDep,
):
    """
    Answer an intake question and get the next question.

    This endpoint:
    1. Validates the answer
    2. Finds the patient and visit
    3. Adds the answer to the intake session
    4. Generates next question or completes intake
    5. Returns next question or completion status
    """
    try:
        # Convert Pydantic model to DTO
        dto_request = AnswerIntakeRequest(
            patient_id=request.patient_id,
            visit_id=request.visit_id,
            answer=request.answer,
        )

        # Execute use case
        use_case = AnswerIntakeUseCase(patient_repo, question_service)
        result = await use_case.execute(dto_request)

        return AnswerIntakeResponse(
            next_question=result.next_question,
            is_complete=result.is_complete,
            question_count=result.question_count,
            max_questions=result.max_questions,
            message=result.message,
        )

    except PatientNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "PATIENT_NOT_FOUND",
                "message": e.message,
                "details": e.details,
            },
        )
    except VisitNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "VISIT_NOT_FOUND",
                "message": e.message,
                "details": e.details,
            },
        )
    except IntakeAlreadyCompletedError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "INTAKE_ALREADY_COMPLETED",
                "message": e.message,
                "details": e.details,
            },
        )
    except (QuestionLimitExceededError, DuplicateQuestionError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": e.error_code, "message": e.message, "details": e.details},
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
    "/resolve",
    response_model=ResolvePatientResponse,
    status_code=status.HTTP_200_OK,
    responses={
        400: {"model": ErrorResponse, "description": "Validation error"},
        422: {"model": ErrorResponse, "description": "Invalid disease"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def resolve_patient(
    request: ResolvePatientRequestSchema,
    patient_repo: PatientRepositoryDep,
):
    """
    Resolve patient identity and determine next action.

    This endpoint:
    1. Checks for exact match (name + mobile) - returning patient
    2. Checks for mobile-only match - family members
    3. Returns new patient option if no matches found
    """
    try:
        # Convert Pydantic model to DTO
        dto_request = ResolvePatientRequest(
            name=request.name,
            mobile=request.mobile,
            age=request.age,
            disease=request.disease,
        )

        # Execute use case
        use_case = ResolvePatientUseCase(patient_repo)
        result = await use_case.execute(dto_request)

        # Convert result to response
        response_data = {
            "resolution_type": result.resolution_type,
            "action": result.action,
            "message": result.message,
        }

        # Add patient data if exact match
        if result.patient:
            response_data["patient"] = PatientSummarySchema(
                patient_id=result.patient.patient_id.value,
                name=result.patient.name,
                mobile=result.patient.mobile,
                age=result.patient.age,
                created_at=result.patient.created_at.isoformat(),
                total_visits=len(result.patient.visits),
                latest_visit=None,  # Could be enhanced to include latest visit
            )

        # Add candidates if family members found
        if result.candidates:
            candidates = []
            for candidate in result.candidates:
                candidates.append(
                    PatientCandidateSchema(
                        patient_id=candidate.patient_id.value,
                        name=candidate.name,
                        age=candidate.age,
                        total_visits=len(candidate.visits),
                        last_visit_date=candidate.visits[-1].created_at if candidate.visits else None,
                    )
                )
            response_data["candidates"] = candidates

        return ResolvePatientResponse(**response_data)

    except InvalidDiseaseError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "INVALID_DISEASE",
                "message": e.message,
                "details": e.details,
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
    "/family-member/start-visit",
    response_model=FamilyMemberSelectionResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse, "description": "Validation error"},
        404: {"model": ErrorResponse, "description": "Patient not found"},
        422: {"model": ErrorResponse, "description": "Invalid disease"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def start_visit_for_family_member(
    request: FamilyMemberSelectionRequestSchema,
    patient_repo: PatientRepositoryDep,
    question_service: QuestionServiceDep,
):
    """
    Start a new visit for an existing patient (family member).

    This endpoint:
    1. Validates the selected patient exists
    2. Creates a new visit for the existing patient
    3. Generates first question based on disease
    4. Returns visit details and first question
    """
    try:
        # Convert Pydantic model to DTO
        dto_request = FamilyMemberSelectionRequest(
            selected_patient_id=request.selected_patient_id,
            disease=request.disease,
        )

        # Execute use case
        use_case = StartVisitForPatientUseCase(patient_repo, question_service)
        result = await use_case.execute(dto_request)

        return FamilyMemberSelectionResponse(
            patient_id=result.patient_id,
            visit_id=result.visit_id,
            first_question=result.first_question,
            message=result.message,
        )

    except PatientNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "PATIENT_NOT_FOUND",
                "message": e.message,
                "details": e.details,
            },
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
