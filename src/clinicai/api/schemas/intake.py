"""Pydantic schemas for repeat intake logic endpoints."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator


class IntakeStartRequest(BaseModel):
    """Request schema for starting an intake session."""

    name: str = Field(..., min_length=2, max_length=80, description="Patient name")
    phone: str = Field(..., min_length=10, max_length=20, description="Phone number")
    age: Optional[int] = Field(None, ge=0, le=120, description="Patient age")
    patient_id_hint: Optional[str] = Field(None, description="Optional patient ID hint")
    idempotency_key: Optional[str] = Field(
        None, description="Idempotency key for repeat submissions"
    )
    otp_verified: bool = Field(False, description="Whether phone is OTP verified")

    @validator("name")
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()

    @validator("phone")
    def validate_phone(cls, v):
        # Remove all non-digit characters for validation
        clean_phone = "".join(filter(str.isdigit, v))
        if len(clean_phone) < 10 or len(clean_phone) > 15:
            raise ValueError("Phone number must be 10-15 digits")
        return v


class IntakeStartResponse(BaseModel):
    """Response schema for starting an intake session."""

    action: str = Field(
        ...,
        description="Action taken: existing_patient_new_visit or new_patient_created",
    )
    patient_id: str = Field(..., description="Patient ID")
    visit_id: str = Field(..., description="Visit ID")
    message: str = Field(..., description="Status message")
    patient: Optional[dict] = Field(None, description="Resolved patient object")
    visit: Optional[dict] = Field(None, description="Newly created visit object")


class IntakeSubmitRequest(BaseModel):
    """Request schema for submitting intake answers."""

    patient_id: str = Field(..., description="Patient ID")
    visit_id: str = Field(..., description="Visit ID")
    answers: Dict[str, Any] = Field(..., description="Intake answers")

    @validator("answers")
    def validate_answers(cls, v):
        if not v:
            raise ValueError("Answers cannot be empty")
        return v


class IntakeSubmitResponse(BaseModel):
    """Response schema for submitting intake answers."""

    visit_id: str = Field(..., description="Visit ID")
    status: str = Field(..., description="Visit status")
    total_questions: int = Field(..., description="Total questions answered")
    message: str = Field(..., description="Status message")


class VisitSummarySchema(BaseModel):
    """Schema for visit summary in history."""

    visit_id: str = Field(..., description="Visit ID")
    status: str = Field(..., description="Visit status")
    created_at: str = Field(..., description="Visit creation time")
    completed_at: Optional[str] = Field(None, description="Visit completion time")
    total_questions: int = Field(..., description="Total questions answered")
    intake_duration_seconds: Optional[int] = Field(
        None, description="Intake duration in seconds"
    )


class VisitHistoryResponse(BaseModel):
    """Response schema for visit history."""

    patient_id: str = Field(..., description="Patient ID")
    total_visits: int = Field(..., description="Total number of visits")
    visits: List[VisitSummarySchema] = Field(..., description="List of visits")


class PatientSummarySchema(BaseModel):
    """Schema for patient summary."""

    patient_id: str = Field(..., description="Patient ID")
    name: str = Field(..., description="Patient name")
    phone_e164: str = Field(..., description="Phone number in E.164 format")
    age: Optional[int] = Field(None, description="Patient age")
    gender: Optional[str] = Field(None, description="Patient gender")
    total_visits: int = Field(..., description="Total number of visits")
    created_at: str = Field(..., description="Patient creation time")
    updated_at: str = Field(..., description="Patient last update time")


class ErrorResponse(BaseModel):
    """Error response schema."""

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(
        None, description="Additional error details"
    )
