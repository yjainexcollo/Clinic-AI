"""Enhanced Visit domain entity for repeat intake logic with stable identity."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..value_objects.stable_visit_id import StableVisitId
from ..value_objects.idempotency_key import IdempotencyKey


@dataclass
class IntakeSnapshot:
    """Snapshot of intake data for a specific visit."""
    
    answers: Dict[str, Any] = field(default_factory=dict)
    completed_at: Optional[datetime] = None
    total_questions: int = 0
    intake_duration_seconds: Optional[int] = None


@dataclass
class VisitSummary:
    """Summary data for a visit."""
    
    chief_complaint: Optional[str] = None
    symptoms: List[str] = field(default_factory=list)
    diagnosis: Optional[str] = None
    treatment_plan: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class StableVisit:
    """Enhanced Visit domain entity with stable identity for repeat intakes."""

    visit_id: StableVisitId
    patient_id: str  # Reference to patient
    status: str = "open"  # open, in_progress, completed, cancelled
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    
    # Intake data
    intake_snapshot: Optional[IntakeSnapshot] = None
    
    # Visit summaries and notes
    summaries: List[VisitSummary] = field(default_factory=list)
    notes: Optional[str] = None
    
    # Idempotency tracking
    idempotency_key: Optional[IdempotencyKey] = None

    def __post_init__(self) -> None:
        """Initialize visit with default intake snapshot."""
        if self.intake_snapshot is None:
            self.intake_snapshot = IntakeSnapshot()

    def start_intake(self, idempotency_key: Optional[IdempotencyKey] = None) -> None:
        """Start the intake process for this visit."""
        self.status = "in_progress"
        self.idempotency_key = idempotency_key
        self.updated_at = datetime.utcnow()

    def submit_intake_answers(self, answers: Dict[str, Any]) -> None:
        """Submit intake answers for this visit."""
        if self.status not in ["open", "in_progress"]:
            raise ValueError(f"Cannot submit answers for visit with status: {self.status}")
        
        self.intake_snapshot.answers.update(answers)
        self.intake_snapshot.total_questions = len(answers)
        self.status = "in_progress"
        self.updated_at = datetime.utcnow()

    def complete_intake(self) -> None:
        """Complete the intake process for this visit."""
        if self.status != "in_progress":
            raise ValueError(f"Cannot complete intake for visit with status: {self.status}")
        
        self.intake_snapshot.completed_at = datetime.utcnow()
        self.status = "completed"
        self.updated_at = datetime.utcnow()

    def cancel_visit(self, reason: Optional[str] = None) -> None:
        """Cancel this visit."""
        self.status = "cancelled"
        if reason:
            self.notes = reason
        self.updated_at = datetime.utcnow()

    def add_summary(self, summary: VisitSummary) -> None:
        """Add a summary to this visit."""
        self.summaries.append(summary)
        self.updated_at = datetime.utcnow()

    def add_note(self, note: str) -> None:
        """Add a note to this visit."""
        if self.notes:
            self.notes += f"\n{note}"
        else:
            self.notes = note
        self.updated_at = datetime.utcnow()

    def is_active(self) -> bool:
        """Check if visit is active (open or in_progress)."""
        return self.status in ["open", "in_progress"]

    def is_completed(self) -> bool:
        """Check if visit is completed."""
        return self.status == "completed"

    def get_intake_summary(self) -> Dict[str, Any]:
        """Get summary of intake session."""
        return {
            "visit_id": self.visit_id.value,
            "status": self.status,
            "total_questions": self.intake_snapshot.total_questions if self.intake_snapshot else 0,
            "completed_at": (
                self.intake_snapshot.completed_at.isoformat()
                if self.intake_snapshot and self.intake_snapshot.completed_at
                else None
            ),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def get_visit_details(self) -> Dict[str, Any]:
        """Get detailed visit information."""
        return {
            "visit_id": self.visit_id.value,
            "patient_id": self.patient_id,
            "status": self.status,
            "intake_snapshot": (
                {
                    "answers": self.intake_snapshot.answers,
                    "total_questions": self.intake_snapshot.total_questions,
                    "completed_at": (
                        self.intake_snapshot.completed_at.isoformat()
                        if self.intake_snapshot.completed_at
                        else None
                    ),
                    "intake_duration_seconds": self.intake_snapshot.intake_duration_seconds,
                }
                if self.intake_snapshot
                else None
            ),
            "summaries": [
                {
                    "chief_complaint": summary.chief_complaint,
                    "symptoms": summary.symptoms,
                    "diagnosis": summary.diagnosis,
                    "treatment_plan": summary.treatment_plan,
                    "notes": summary.notes,
                }
                for summary in self.summaries
            ],
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
