"""Answer Intake use case for Step-01 functionality.

Formatting-only changes; behavior preserved.
"""

from ...domain.errors import (
    IntakeAlreadyCompletedError,
    PatientNotFoundError,
    VisitNotFoundError,
)
from ...domain.value_objects.patient_id import PatientId
from ..dto.patient_dto import AnswerIntakeRequest, AnswerIntakeResponse
from ..ports.repositories.patient_repo import PatientRepository
from ..ports.services.question_service import QuestionService


class AnswerIntakeUseCase:
    """Use case for answering intake questions."""

    def __init__(
        self, patient_repository: PatientRepository, question_service: QuestionService
    ):
        self._patient_repository = patient_repository
        self._question_service = question_service

    async def execute(self, request: AnswerIntakeRequest) -> AnswerIntakeResponse:
        """Execute the answer intake use case."""
        # Find patient
        patient_id = PatientId(request.patient_id)
        patient = await self._patient_repository.find_by_id(patient_id)
        if not patient:
            raise PatientNotFoundError(request.patient_id)

        # Find visit
        visit = patient.get_visit_by_id(request.visit_id)
        if not visit:
            raise VisitNotFoundError(request.visit_id)

        # Check if intake is already completed
        if visit.is_intake_complete():
            raise IntakeAlreadyCompletedError(request.visit_id)

        # Get the current question being answered
        # If this is the first answer, we need to generate the first question
        if visit.intake_session.current_question_count == 0:
            current_question = await self._question_service.generate_first_question(
                visit.disease
            )
        else:
            # For subsequent answers, we need to get the question that was just asked
            # This should be stored in the visit's current_question field
            # For now, we'll generate it based on context
            previous_answers = [
                qa.answer for qa in visit.intake_session.questions_asked
            ]
            asked_questions = [
                qa.question for qa in visit.intake_session.questions_asked
            ]

            current_question = await self._question_service.generate_next_question(
                disease=visit.disease,
                previous_answers=previous_answers,
                asked_questions=asked_questions,
                current_count=visit.intake_session.current_question_count,
                max_count=visit.intake_session.max_questions,
            )

        # Add the question and answer
        visit.add_question_answer(current_question, request.answer)

        # Check if we should stop asking questions
        should_stop = await self._question_service.should_stop_asking(
            disease=visit.disease,
            previous_answers=[qa.answer for qa in visit.intake_session.questions_asked],
            current_count=visit.intake_session.current_question_count,
            max_count=visit.intake_session.max_questions,
        )

        next_question = None
        is_complete = False

        if should_stop or not visit.can_ask_more_questions():
            # Complete the intake
            visit.complete_intake()
            is_complete = True
            message = "Intake completed successfully. Ready for next step."
        else:
            # Generate next question
            previous_answers = [
                qa.answer for qa in visit.intake_session.questions_asked
            ]
            asked_questions = [
                qa.question for qa in visit.intake_session.questions_asked
            ]

            next_question = await self._question_service.generate_next_question(
                disease=visit.disease,
                previous_answers=previous_answers,
                asked_questions=asked_questions,
                current_count=visit.intake_session.current_question_count,
                max_count=visit.intake_session.max_questions,
            )
            message = f"Question {visit.intake_session.current_question_count + 1} of {visit.intake_session.max_questions}"

        # Save the updated patient
        await self._patient_repository.save(patient)

        # Raise domain events
        # Note: In a real implementation, you'd have an event bus

        return AnswerIntakeResponse(
            next_question=next_question,
            is_complete=is_complete,
            question_count=visit.intake_session.current_question_count,
            max_questions=visit.intake_session.max_questions,
            message=message,
        )
