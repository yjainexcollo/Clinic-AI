"""Enhanced MongoDB Beanie models for stable patient/visit entities."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from beanie import Document
from pydantic import Field


class IntakeSnapshotMongo(Document):
    """MongoDB model for intake snapshot."""

    answers: Dict[str, Any] = Field(default_factory=dict)
    completed_at: Optional[datetime] = None
    total_questions: int = 0
    intake_duration_seconds: Optional[int] = None


class VisitSummaryMongo(Document):
    """MongoDB model for visit summary."""

    chief_complaint: Optional[str] = None
    symptoms: List[str] = Field(default_factory=list)
    diagnosis: Optional[str] = None
    treatment_plan: Optional[str] = None
    notes: Optional[str] = None


class StableVisitMongo(Document):
    """MongoDB model for stable visit entity."""

    visit_id: str = Field(..., description="Visit ID (UUID)", unique=True)
    patient_id: str = Field(..., description="Patient ID reference")
    status: str = Field(default="open")  # open, in_progress, completed, cancelled
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Intake data
    intake_snapshot: Optional[IntakeSnapshotMongo] = None

    # Visit summaries and notes
    summaries: List[VisitSummaryMongo] = Field(default_factory=list)
    notes: Optional[str] = None

    # Idempotency tracking
    idempotency_key: Optional[str] = None

    class Settings:
        name = "stable_visits"
        indexes = [
            "visit_id",
            "patient_id",
            "status",
            "created_at",
            "idempotency_key",
        ]


class StablePatientMongo(Document):
    """MongoDB model for stable patient entity."""

    patient_id: str = Field(..., description="Patient ID (UUID)", unique=True)
    name: str = Field(..., description="Patient name")
    phone_e164: str = Field(..., description="Phone number in E.164 format")
    age: Optional[int] = Field(None, description="Patient age")
    gender: Optional[str] = Field(None, description="Patient gender")
    date_of_birth: Optional[datetime] = Field(None, description="Date of birth")

    # Normalized fields for matching
    name_normalized: str = Field(..., description="Normalized name for matching")
    phone_normalized: str = Field(..., description="Normalized phone for matching")

    visits: List[StableVisitMongo] = Field(default_factory=list, description="List of visits")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "stable_patients"
        indexes = [
            "patient_id",
            "name_normalized",
            "phone_normalized",
            # Compound index for patient matching
            [("name_normalized", 1), ("phone_normalized", 1)],
            "created_at",
        ]


class IdempotencyRecordMongo(Document):
    """MongoDB model for idempotency tracking."""

    idempotency_key: str = Field(..., description="Idempotency key", unique=True)
    patient_id: str = Field(..., description="Patient ID")
    visit_id: str = Field(..., description="Visit ID")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime = Field(..., description="Expiration time (10 minutes from creation)")

    class Settings:
        name = "idempotency_records"
        indexes = [
            "idempotency_key",
            "expires_at",
        ]
