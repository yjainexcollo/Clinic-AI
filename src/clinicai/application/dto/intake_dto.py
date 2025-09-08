"""DTOs for repeat intake logic endpoints."""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class IntakeStartRequest:
    """Request DTO for starting an intake session."""

    name: str
    phone: str
    age: Optional[int] = None
    patient_id_hint: Optional[str] = None
    idempotency_key: Optional[str] = None
    otp_verified: bool = False


@dataclass
class IntakeStartResponse:
    """Response DTO for starting an intake session."""

    action: str  # "existing_patient_new_visit" | "new_patient_created"
    patient_id: str
    visit_id: str
    message: str
    # Optional enriched objects for caller convenience
    patient: Optional[dict] = None
    visit: Optional[dict] = None


@dataclass
class IntakeSubmitRequest:
    """Request DTO for submitting intake answers."""

    patient_id: str
    visit_id: str
    answers: Dict[str, Any]


@dataclass
class IntakeSubmitResponse:
    """Response DTO for submitting intake answers."""

    visit_id: str
    status: str
    total_questions: int
    message: str


@dataclass
class VisitHistoryRequest:
    """Request DTO for getting visit history."""

    patient_id: str
    limit: int = 100
    offset: int = 0


@dataclass
class VisitSummaryDTO:
    """DTO for visit summary in history."""

    visit_id: str
    status: str
    created_at: str
    completed_at: Optional[str]
    total_questions: int
    intake_duration_seconds: Optional[int]


@dataclass
class VisitHistoryResponse:
    """Response DTO for visit history."""

    patient_id: str
    total_visits: int
    visits: List[VisitSummaryDTO]


@dataclass
class PatientSummaryDTO:
    """DTO for patient summary."""

    patient_id: str
    name: str
    phone_e164: str
    age: Optional[int]
    gender: Optional[str]
    total_visits: int
    created_at: str
    updated_at: str
