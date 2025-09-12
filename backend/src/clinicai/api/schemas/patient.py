"""
Pydantic schemas for patient-related API endpoints.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, validator


class RegisterPatientRequest(BaseModel):
    """Request schema for patient registration."""

    name: str = Field(..., min_length=2, max_length=80, description="Patient name")
    mobile: str = Field(..., min_length=10, max_length=15, description="Mobile number")
    age: int = Field(..., ge=0, le=120, description="Patient age")
    gender: str = Field(..., description="Patient gender (e.g., male, female, other)")
    recently_travelled: bool = Field(False, description="Has the patient travelled recently")

    @validator("name")
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()

    @validator("mobile")
    def validate_mobile(cls, v):
        # Remove all non-digit characters
        clean_mobile = "".join(filter(str.isdigit, v))
        if len(clean_mobile) < 10 or len(clean_mobile) > 15:
            raise ValueError("Mobile number must be 10-15 digits")
        return clean_mobile

    @validator("gender")
    def validate_gender(cls, v):
        if not v or not v.strip():
            raise ValueError("Gender cannot be empty")
        return v.strip()


class RegisterPatientResponse(BaseModel):
    """Response schema for patient registration."""

    patient_id: str = Field(..., description="Generated patient ID")
    visit_id: str = Field(..., description="Generated visit ID")
    first_question: str = Field(..., description="First question for intake")
    message: str = Field(..., description="Success message")


class AnswerIntakeRequest(BaseModel):
    """Request schema for answering intake questions."""

    patient_id: str = Field(..., description="Patient ID")
    visit_id: str = Field(..., description="Visit ID")
    answer: str = Field(
        ..., min_length=1, max_length=1000, description="Answer to the question"
    )
    attachment_image_path: Optional[str] = Field(
        None, description="Optional path to a medication image if provided"
    )

    @validator("answer")
    def validate_answer(cls, v):
        if not v or not v.strip():
            raise ValueError("Answer cannot be empty")
        return v.strip()


class AnswerIntakeResponse(BaseModel):
    """Response schema for answering intake questions."""

    next_question: Optional[str] = Field(None, description="Next question (if any)")
    is_complete: bool = Field(..., description="Whether intake is complete")
    question_count: int = Field(..., description="Current question count")
    max_questions: int = Field(..., description="Maximum questions allowed")
    message: str = Field(..., description="Status message")


class EditAnswerRequest(BaseModel):
    """Request schema for editing an existing answer."""

    patient_id: str = Field(..., description="Patient ID")
    visit_id: str = Field(..., description="Visit ID")
    question_number: int = Field(..., ge=1, description="Question number to edit (1-based)")
    new_answer: str = Field(..., min_length=1, max_length=1000, description="Replacement answer")


class EditAnswerResponse(BaseModel):
    success: bool = Field(...)
    message: str = Field(...)


class QuestionAnswerSchema(BaseModel):
    """Schema for question-answer pair."""

    question_id: str = Field(..., description="Question ID")
    question: str = Field(..., description="Question text")
    answer: str = Field(..., description="Answer text")
    timestamp: datetime = Field(..., description="Timestamp")
    question_number: int = Field(..., description="Question number in sequence")


class IntakeSummarySchema(BaseModel):
    """Schema for intake session summary."""

    visit_id: str = Field(..., description="Visit ID")
    symptom: str = Field(..., description="Primary symptom")
    status: str = Field(..., description="Visit status")
    questions_asked: List[QuestionAnswerSchema] = Field(
        ..., description="List of questions and answers"
    )
    total_questions: int = Field(..., description="Total questions asked")
    max_questions: int = Field(..., description="Maximum questions allowed")
    intake_status: str = Field(..., description="Intake session status")
    started_at: datetime = Field(..., description="Intake start time")
    completed_at: Optional[datetime] = Field(None, description="Intake completion time")


class PatientSummarySchema(BaseModel):
    """Schema for patient summary."""

    patient_id: str = Field(..., description="Patient ID")
    name: str = Field(..., description="Patient name")
    mobile: str = Field(..., description="Mobile number")
    age: int = Field(..., description="Patient age")
    gender: Optional[str] = Field(None, description="Patient gender")
    created_at: datetime = Field(..., description="Registration date")
    total_visits: int = Field(..., description="Total number of visits")
    latest_visit: Optional[IntakeSummarySchema] = Field(
        None, description="Latest visit details"
    )


 


class ErrorResponse(BaseModel):
    """Error response schema."""

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[dict] = Field(None, description="Additional error details")


# Step-02: Pre-Visit Summary Schemas
class PreVisitSummaryRequest(BaseModel):
    """Request schema for generating pre-visit summary."""

    patient_id: str = Field(..., pattern='^[A-Z0-9]+_\d+$', description="Patient ID")
    visit_id: str = Field(..., pattern='^CONSULT-\d{8}-\d{3}$', description="Visit ID")


class PreVisitSummaryResponse(BaseModel):
    """Response schema for pre-visit summary."""

    patient_id: str = Field(..., description="Patient ID")
    visit_id: str = Field(..., description="Visit ID")
    summary: str = Field(..., description="Clinical summary in markdown format")
    structured_data: dict = Field(..., description="Structured clinical data")
    generated_at: str = Field(..., description="Summary generation timestamp")
    message: str = Field(..., description="Status message")
