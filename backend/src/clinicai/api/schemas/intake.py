"""
Schemas for Intake schema and validation endpoints.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class IntakeQuestion(BaseModel):
    question_id: str = Field(..., description="Unique question identifier")
    text: str = Field(..., description="Question text")
    type: str = Field(..., description="Type: string|number|boolean|array|object")
    required: bool = Field(False, description="Whether the field is required")
    enum: Optional[List[Any]] = Field(None, description="Allowed values if enumerated")
    depends_on: Optional[str] = Field(None, description="Optional dependency key")
    visible_if: Optional[Dict[str, Any]] = Field(
        None, description="Visibility condition mapping question_id->value"
    )


class IntakeSchema(BaseModel):
    version: str = Field(..., description="Schema version")
    clinic_code: Optional[str] = Field(None, description="Clinic code")
    max_questions: int = Field(10, ge=1, le=20, description="Max adaptive questions")
    questions: List[IntakeQuestion] = Field(..., description="Question definitions")


class ValidateAnswersRequest(BaseModel):
    patient_id: Optional[str] = Field(None, description="Opaque patient id (optional)")
    answers: Dict[str, Any] = Field(..., description="Answer map question_id->value")


class ValidateAnswersResponse(BaseModel):
    valid: bool = Field(...)
    errors: List[Dict[str, Any]] = Field(default_factory=list)
    message: str = Field(...)


