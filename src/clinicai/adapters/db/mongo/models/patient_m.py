"""
MongoDB Beanie models used by the persistence layer.

Note: These are persisted documents; structure left unchanged to preserve runtime behavior.
"""

from datetime import datetime
from typing import List, Optional

from beanie import Document
from pydantic import Field


class QuestionAnswerMongo(Document):
    """MongoDB model for question-answer pair."""
    question_id: str = Field(..., description="Question ID")
    question: str = Field(..., description="Question text")
    answer: str = Field(..., description="Answer text")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    question_number: int = Field(..., description="Question number in sequence")


class IntakeSessionMongo(Document):
    """MongoDB model for intake session."""
    disease: str = Field(..., description="Disease/complaint")
    questions_asked: List[QuestionAnswerMongo] = Field(default_factory=list)
    current_question_count: int = Field(default=0)
    max_questions: int = Field(default=12)
    status: str = Field(default="in_progress")  # in_progress, completed, cancelled
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class VisitMongo(Document):
    """MongoDB model for visit."""
    visit_id: str = Field(..., description="Visit ID")
    patient_id: str = Field(..., description="Patient ID reference")
    disease: str = Field(..., description="Disease/complaint")
    status: str = Field(
        default="intake"
    )  # intake, transcription, soap_generation, prescription_analysis, completed
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Step 1: Pre-Visit Intake
    intake_session: Optional[IntakeSessionMongo] = None


class PatientMongo(Document):
    """MongoDB model for Patient entity."""

    patient_id: str = Field(..., description="Patient ID", unique=True)
    name: str = Field(..., description="Patient name")
    mobile: str = Field(..., description="Mobile number")
    age: int = Field(..., description="Patient age")
    visits: List[VisitMongo] = Field(default_factory=list, description="List of visits")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "patients"
        indexes = [
            "patient_id",
            "name",
            "mobile",
            "created_at"
        ]
