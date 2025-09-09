"""Visit domain entity representing a single consultation visit.

Includes the intake session for Step-01 functionality. Formatting-only changes.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..errors import (
    DuplicateQuestionError,
    IntakeAlreadyCompletedError,
    QuestionLimitExceededError,
)
from ..value_objects.question_id import QuestionId
from ..value_objects.visit_id import VisitId


@dataclass
class QuestionAnswer:
    """Question and answer pair."""

    question_id: QuestionId
    question: str
    answer: str
    timestamp: datetime
    question_number: int


@dataclass
class IntakeSession:
    """Intake session data for Step-01."""

    disease: str
    questions_asked: List[QuestionAnswer] = field(default_factory=list)
    current_question_count: int = 0
    max_questions: int = 8
    status: str = "in_progress"  # in_progress, completed, cancelled
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    def __post_init__(self) -> None:
        """Normalize disease string (no fixed whitelist)."""
        if self.disease:
            self.disease = self.disease.strip()

    def add_question_answer(self, question: str, answer: str) -> None:
        """Add a question and answer to the intake."""
        # Check if intake is already completed
        if self.status == "completed":
            raise IntakeAlreadyCompletedError(
                "Cannot add questions to completed intake"
            )

        # Check question limit
        if self.current_question_count >= self.max_questions:
            raise QuestionLimitExceededError(
                self.current_question_count, self.max_questions
            )

        # Check for duplicate questions
        for qa in self.questions_asked:
            if qa.question.lower().strip() == question.lower().strip():
                raise DuplicateQuestionError(question)

        question_id = QuestionId.generate()
        question_answer = QuestionAnswer(
            question_id=question_id,
            question=question,
            answer=answer,
            timestamp=datetime.utcnow(),
            question_number=self.current_question_count + 1,
        )

        self.questions_asked.append(question_answer)
        self.current_question_count += 1

    def can_ask_more_questions(self) -> bool:
        """Check if more questions can be asked."""
        return (
            self.current_question_count < self.max_questions
            and self.status == "in_progress"
        )

    def is_complete(self) -> bool:
        """Check if intake is complete."""
        return self.status == "completed"

    def complete_intake(self) -> None:
        """Mark intake as completed."""
        self.status = "completed"
        self.completed_at = datetime.utcnow()

    def get_question_context(self) -> str:
        """Get context for AI to generate next question."""
        if not self.questions_asked:
            return f"Patient has {self.disease}. Generate the first symptom-focused question."

        # Get last 3 answers for context
        recent_answers = [qa.answer for qa in self.questions_asked[-3:]]
        asked_questions = [qa.question for qa in self.questions_asked]

        context = f"""
        Disease: {self.disease}
        Recent answers: {'; '.join(recent_answers)}
        Already asked questions: {asked_questions}
        Current question count: {self.current_question_count}/{self.max_questions}

        Generate the next symptom-focused question. Do not repeat any already asked questions.
        """
        return context.strip()


@dataclass
class Visit:
    """Visit domain entity."""

    visit_id: VisitId
    patient_id: str  # Reference to patient
    disease: str
    status: str = (
        "intake"  # intake, transcription, soap_generation, prescription_analysis, completed
    )
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    # Step 1: Pre-Visit Intake
    intake_session: Optional[IntakeSession] = None
    
    # Step 2: Pre-Visit Summary (EHR Storage)
    pre_visit_summary: Optional[Dict[str, Any]] = None

    def __post_init__(self) -> None:
        """Initialize intake session."""
        if self.intake_session is None:
            self.intake_session = IntakeSession(disease=self.disease)

    def add_question_answer(self, question: str, answer: str) -> None:
        """Add a question and answer to the intake session."""
        self.intake_session.add_question_answer(question, answer)
        self.updated_at = datetime.utcnow()

    def complete_intake(self) -> None:
        """Complete the intake process."""
        self.intake_session.complete_intake()
        self.status = "transcription"  # Ready for next step
        self.updated_at = datetime.utcnow()

    def can_ask_more_questions(self) -> bool:
        """Check if more questions can be asked."""
        return self.intake_session.can_ask_more_questions()

    def is_intake_complete(self) -> bool:
        """Check if intake is complete."""
        return self.intake_session.is_complete()

    def get_question_context(self) -> str:
        """Get context for AI to generate next question."""
        return self.intake_session.get_question_context()

    def get_intake_summary(self) -> Dict[str, Any]:
        """Get summary of intake session."""
        return {
            "visit_id": self.visit_id.value,
            "disease": self.disease,
            "status": self.status,
            "questions_asked": [
                {
                    "question_id": qa.question_id.value,
                    "question": qa.question,
                    "answer": qa.answer,
                    "timestamp": qa.timestamp.isoformat(),
                    "question_number": qa.question_number,
                }
                for qa in self.intake_session.questions_asked
            ],
            "total_questions": self.intake_session.current_question_count,
            "max_questions": self.intake_session.max_questions,
            "intake_status": self.intake_session.status,
            "started_at": self.intake_session.started_at.isoformat(),
            "completed_at": (
                self.intake_session.completed_at.isoformat()
                if self.intake_session.completed_at
                else None
            ),
        }

    def store_pre_visit_summary(self, summary: str, structured_data: Dict[str, Any]) -> None:
        """Store pre-visit summary in EHR."""
        self.pre_visit_summary = {
            "summary": summary,
            "structured_data": structured_data,
            "generated_at": datetime.utcnow().isoformat(),
            "visit_id": self.visit_id.value,
            "patient_id": self.patient_id,
        }
        self.updated_at = datetime.utcnow()

    def get_pre_visit_summary(self) -> Optional[Dict[str, Any]]:
        """Get stored pre-visit summary from EHR."""
        return self.pre_visit_summary

    def has_pre_visit_summary(self) -> bool:
        """Check if pre-visit summary exists."""
        return self.pre_visit_summary is not None
