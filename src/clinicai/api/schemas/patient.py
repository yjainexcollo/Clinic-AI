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
    disease: str = Field(..., description="Disease/complaint")

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

    @validator("disease")
    def validate_disease(cls, v):
        valid_diseases = [
            "Hypertension",
            "Diabetes",
            "Chest Pain",
            "Fever",
            "Cough",
            "Headache",
            "Back Pain",
        ]
        if v not in valid_diseases:
            raise ValueError(f'Disease must be one of: {", ".join(valid_diseases)}')
        return v


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
    disease: str = Field(..., description="Disease/complaint")
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
    created_at: datetime = Field(..., description="Registration date")
    total_visits: int = Field(..., description="Total number of visits")
    latest_visit: Optional[IntakeSummarySchema] = Field(
        None, description="Latest visit details"
    )


class ResolvePatientRequest(BaseModel):
    """Request schema for patient resolution."""

    name: str = Field(..., min_length=2, max_length=80, description="Patient name")
    mobile: str = Field(..., min_length=10, max_length=15, description="Mobile number")
    age: int = Field(..., ge=0, le=120, description="Patient age")
    disease: str = Field(..., description="Disease/complaint")

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

    @validator("disease")
    def validate_disease(cls, v):
        valid_diseases = [
            "Hypertension",
            "Diabetes",
            "Chest Pain",
            "Fever",
            "Cough",
            "Headache",
            "Back Pain",
        ]
        if v not in valid_diseases:
            raise ValueError(f'Disease must be one of: {", ".join(valid_diseases)}')
        return v


class PatientCandidateSchema(BaseModel):
    """Schema for patient candidate in family member selection."""

    patient_id: str = Field(..., description="Patient ID")
    name: str = Field(..., description="Patient name")
    age: int = Field(..., description="Patient age")
    total_visits: int = Field(..., description="Total number of visits")
    last_visit_date: Optional[datetime] = Field(None, description="Last visit date")


class ResolvePatientResponse(BaseModel):
    """Response schema for patient resolution."""

    resolution_type: str = Field(..., description="Type of resolution")
    action: str = Field(..., description="Recommended action")
    message: str = Field(..., description="Resolution message")
    patient: Optional[PatientSummarySchema] = Field(None, description="Existing patient (if found)")
    candidates: Optional[List[PatientCandidateSchema]] = Field(None, description="Family member candidates")


class FamilyMemberSelectionRequest(BaseModel):
    """Request schema for selecting a family member."""

    selected_patient_id: str = Field(..., description="Selected patient ID")
    disease: str = Field(..., description="Disease/complaint")

    @validator("disease")
    def validate_disease(cls, v):
        valid_diseases = [
            "Hypertension",
            "Diabetes",
            "Chest Pain",
            "Fever",
            "Cough",
            "Headache",
            "Back Pain",
        ]
        if v not in valid_diseases:
            raise ValueError(f'Disease must be one of: {", ".join(valid_diseases)}')
        return v


class FamilyMemberSelectionResponse(BaseModel):
    """Response schema for family member selection."""

    patient_id: str = Field(..., description="Patient ID")
    visit_id: str = Field(..., description="Generated visit ID")
    first_question: str = Field(..., description="First question for intake")
    message: str = Field(..., description="Success message")


class ErrorResponse(BaseModel):
    """Error response schema."""

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[dict] = Field(None, description="Additional error details")
