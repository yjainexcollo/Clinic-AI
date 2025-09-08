"""
Domain events for patient registration and intake process.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from ..value_objects.patient_id import PatientId
from ..value_objects.visit_id import VisitId


@dataclass
class PatientRegistered:
    """Event raised when a patient is registered."""

    patient_id: PatientId
    name: str
    mobile: str
    age: int
    disease: str
    occurred_at: Optional[datetime] = None

    def __post_init__(self):
        if self.occurred_at is None:
            self.occurred_at = datetime.utcnow()


@dataclass
class VisitStarted:
    """Event raised when a visit starts."""

    visit_id: VisitId
    patient_id: PatientId
    disease: str
    start_time: datetime
    occurred_at: Optional[datetime] = None

    def __post_init__(self):
        if self.occurred_at is None:
            self.occurred_at = datetime.utcnow()


@dataclass
class IntakeQuestionAsked:
    """Event raised when an intake question is asked."""

    visit_id: VisitId
    question_id: str
    question: str
    question_number: int
    occurred_at: Optional[datetime] = None

    def __post_init__(self):
        if self.occurred_at is None:
            self.occurred_at = datetime.utcnow()


@dataclass
class IntakeAnswerReceived:
    """Event raised when an intake answer is received."""

    visit_id: VisitId
    question_id: str
    answer: str
    question_number: int
    occurred_at: Optional[datetime] = None

    def __post_init__(self):
        if self.occurred_at is None:
            self.occurred_at = datetime.utcnow()


@dataclass
class IntakeCompleted:
    """Event raised when intake is completed."""

    visit_id: VisitId
    patient_id: PatientId
    total_questions: int
    completion_time: datetime
    occurred_at: Optional[datetime] = None

    def __post_init__(self):
        if self.occurred_at is None:
            self.occurred_at = datetime.utcnow()
