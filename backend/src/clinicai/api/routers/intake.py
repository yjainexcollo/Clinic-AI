"""Intake schema + validation endpoints (Step-01)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from typing import Any, Dict, List

from ..schemas.intake import (
    IntakeSchema,
    IntakeQuestion,
    ValidateAnswersRequest,
    ValidateAnswersResponse,
)
from ...observability.audit import audit_log_event


router = APIRouter(prefix="/intake", tags=["intake"])


def _default_intake_schema() -> IntakeSchema:
    questions: List[IntakeQuestion] = [
        IntakeQuestion(question_id="chief_complaint", text="What is your main concern today?", type="string", required=True),
        IntakeQuestion(question_id="duration", text="How long have you had this issue?", type="string", required=True),
        IntakeQuestion(question_id="pain_scale", text="If pain is present, how intense is it (0-10)?", type="number", required=False),
        IntakeQuestion(question_id="triggers", text="What makes it better or worse?", type="string", required=False),
        IntakeQuestion(question_id="medications", text="List current medications and doses", type="string", required=False),
        IntakeQuestion(question_id="allergies", text="Do you have any allergies?", type="string", required=False),
    ]
    return IntakeSchema(version="v1", clinic_code=None, max_questions=10, questions=questions)


@router.get(
    "/schema",
    response_model=IntakeSchema,
    status_code=status.HTTP_200_OK,
)
async def get_intake_schema() -> IntakeSchema:
    schema = _default_intake_schema()
    await audit_log_event(event="get_intake_schema", payload={"version": schema.version})
    return schema


@router.post(
    "/validate",
    response_model=ValidateAnswersResponse,
    status_code=status.HTTP_200_OK,
)
async def validate_answers(request: ValidateAnswersRequest) -> ValidateAnswersResponse:
    schema = _default_intake_schema()
    errors: List[Dict[str, Any]] = []

    # Required checks
    qmap: Dict[str, IntakeQuestion] = {q.question_id: q for q in schema.questions}
    for qid, q in qmap.items():
        if q.required and qid not in request.answers:
            errors.append({"field": qid, "error": "required"})

    # Type checks (simple)
    for key, value in request.answers.items():
        q = qmap.get(key)
        if not q:
            continue
        if q.type == "number" and not isinstance(value, (int, float)):
            errors.append({"field": key, "error": "type_mismatch:number"})
        if q.type == "boolean" and not isinstance(value, bool):
            errors.append({"field": key, "error": "type_mismatch:boolean"})
        if q.type == "string" and not isinstance(value, str):
            errors.append({"field": key, "error": "type_mismatch:string"})
        if q.enum is not None and value not in q.enum:
            errors.append({"field": key, "error": "invalid_enum"})

    valid = len(errors) == 0
    message = "valid" if valid else "validation_errors"
    await audit_log_event(event="validate_answers", patient_id=request.patient_id, payload={"valid": valid, "errors": errors})
    if not valid:
        return ValidateAnswersResponse(valid=False, errors=errors, message=message)
    return ValidateAnswersResponse(valid=True, errors=[], message=message)


