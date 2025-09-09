"""Patient DTOs for API communication.

Removed unused imports; behavior unchanged.
"""

from dataclasses import dataclass
from typing import List, Optional

from ...domain.entities.patient import Patient


@dataclass
class RegisterPatientRequest:
    """Request DTO for patient registration."""

    name: str
    mobile: str
    age: int
    disease: str


@dataclass
class RegisterPatientResponse:
    """Response DTO for patient registration."""

    patient_id: str
    visit_id: str
    first_question: str
    message: str


@dataclass
class AnswerIntakeRequest:
    """Request DTO for answering intake questions."""

    patient_id: str
    visit_id: str
    answer: str


@dataclass
class AnswerIntakeResponse:
    """Response DTO for answering intake questions."""

    next_question: Optional[str]
    is_complete: bool
    question_count: int
    max_questions: int
    message: str


@dataclass
class QuestionAnswerDTO:
    """DTO for question-answer pair."""

    question_id: str
    question: str
    answer: str
    timestamp: str
    question_number: int


@dataclass
class IntakeSummaryDTO:
    """DTO for intake session summary."""

    visit_id: str
    disease: str
    status: str
    questions_asked: List[QuestionAnswerDTO]
    total_questions: int
    max_questions: int
    intake_status: str
    started_at: str
    completed_at: Optional[str]


@dataclass
class PatientSummaryDTO:
    """DTO for patient summary."""

    patient_id: str
    name: str
    mobile: str
    age: int
    created_at: str
    total_visits: int
    latest_visit: Optional[IntakeSummaryDTO]


@dataclass
class ResolvePatientRequest:
    """Request DTO for patient resolution."""

    name: str
    mobile: str
    age: int
    disease: str


@dataclass
class PatientResolutionResult:
    """Result DTO for patient resolution."""

    patient: Optional[Patient] = None
    candidates: Optional[List[Patient]] = None
    resolution_type: str = ""  # "exact_match", "mobile_match", "new_patient"
    action: str = ""  # "continue_existing", "select_or_create", "create_new"
    message: str = ""


@dataclass
class PatientCandidateDTO:
    """DTO for patient candidate in family member selection."""

    patient_id: str
    name: str
    age: int
    total_visits: int
    last_visit_date: Optional[str]


@dataclass
class FamilyMemberSelectionRequest:
    """Request DTO for selecting a family member."""

    selected_patient_id: str
    disease: str


@dataclass
class FamilyMemberSelectionResponse:
    """Response DTO for family member selection."""

    patient_id: str
    visit_id: str
    first_question: str
    message: str


# Step-02: Pre-Visit Summary DTOs
@dataclass
class PreVisitSummaryRequest:
    """Request DTO for generating pre-visit summary."""

    patient_id: str
    visit_id: str


@dataclass
class PreVisitSummaryResponse:
    """Response DTO for pre-visit summary."""

    patient_id: str
    visit_id: str
    summary: str
    structured_data: dict
    generated_at: str
    message: str
