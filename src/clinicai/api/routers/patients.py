"""Patient-related API endpoints.

Formatting-only changes; behavior preserved.
"""

from fastapi import APIRouter, HTTPException, status
import logging
import traceback

from clinicai.application.dto.patient_dto import (
    AnswerIntakeRequest,
    PreVisitSummaryRequest,
    RegisterPatientRequest,
)
from clinicai.application.use_cases.answer_intake import AnswerIntakeUseCase
from clinicai.application.use_cases.generate_pre_visit_summary import GeneratePreVisitSummaryUseCase
from clinicai.application.use_cases.register_patient import RegisterPatientUseCase
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
from ..schemas.patient import AnswerIntakeResponse, ErrorResponse
from ..schemas.patient import (
    PatientSummarySchema,
    PreVisitSummaryResponse,
    RegisterPatientResponse,
)

router = APIRouter(prefix="/patients", tags=["patients"])
logger = logging.getLogger("clinicai")


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
        logger.error("Unhandled error in register_patient", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": {"exception": str(e) or repr(e), "type": e.__class__.__name__},
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
    2. Finds the patient and visi
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
        logger.error("Unhandled error in answer_intake_question", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": {"exception": str(e) or repr(e), "type": e.__class__.__name__},
            },
        )


@router.post(
    "/summary/previsit",
    response_model=PreVisitSummaryResponse,
    status_code=status.HTTP_200_OK,
    responses={
        400: {"model": ErrorResponse, "description": "Validation error"},
        404: {"model": ErrorResponse, "description": "Patient or visit not found"},
        422: {"model": ErrorResponse, "description": "Intake not completed"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def generate_pre_visit_summary(
    request: PreVisitSummaryRequest,
    patient_repo: PatientRepositoryDep,
    question_service: QuestionServiceDep,
):
    """
    Generate pre-visit clinical summary from completed intake data.

    This endpoint:
    1. Validates patient and visit exist
    2. Checks intake is completed
    3. Generates AI-powered clinical summary
    4. Returns structured summary for doctor review
    """
    try:
        # Convert Pydantic model to DTO
        dto_request = PreVisitSummaryRequest(
            patient_id=request.patient_id,
            visit_id=request.visit_id,
        )

        # Execute use case
        use_case = GeneratePreVisitSummaryUseCase(patient_repo, question_service)
        result = await use_case.execute(dto_request)

        return PreVisitSummaryResponse(
            patient_id=result.patient_id,
            visit_id=result.visit_id,
            summary=result.summary,
            structured_data=result.structured_data,
            generated_at=result.generated_at,
            message=result.message,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "INTAKE_NOT_COMPLETED",
                "message": str(e),
                "details": {},
            },
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
    except Exception as e:
        logger.error("Unhandled error in generate_pre_visit_summary", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": {"exception": str(e) or repr(e), "type": e.__class__.__name__},
            },
        )


@router.get(
    "/{patient_id}/visits/{visit_id}/summary",
    response_model=PreVisitSummaryResponse,
    status_code=status.HTTP_200_OK,
    responses={
        404: {"model": ErrorResponse, "description": "Patient, visit, or summary not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def get_pre_visit_summary(
    patient_id: str,
    visit_id: str,
    patient_repo: PatientRepositoryDep,
):
    """
    Retrieve stored pre-visit summary from EHR.

    This endpoint:
    1. Validates patient and visit exist
    2. Retrieves stored pre-visit summary from EHR
    3. Returns the clinical summary for doctor review
    """
    try:
        from ...domain.value_objects.patient_id import PatientId
        
        # Find patient
        patient_id_obj = PatientId(patient_id)
        patient = await patient_repo.find_by_id(patient_id_obj)
        if not patient:
            raise PatientNotFoundError(patient_id)

        # Find visit
        visit = patient.get_visit_by_id(visit_id)
        if not visit:
            raise VisitNotFoundError(visit_id)

        # Check if summary exists
        if not visit.has_pre_visit_summary():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "SUMMARY_NOT_FOUND",
                    "message": f"No pre-visit summary found for visit {visit_id}",
                    "details": {"visit_id": visit_id},
                },
            )

        # Get stored summary
        summary_data = visit.get_pre_visit_summary()

        return PreVisitSummaryResponse(
            patient_id=patient.patient_id.value,
            visit_id=visit.visit_id.value,
            summary=summary_data["summary"],
            structured_data=summary_data["structured_data"],
            generated_at=summary_data["generated_at"],
            message="Pre-visit summary retrieved from EHR"
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
    except Exception as e:
        logger.error("Unhandled error in get_pre_visit_summary", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": {"exception": str(e) or repr(e), "type": e.__class__.__name__},
            },
        )


 
