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

        # Generate the current question being answered
        if visit.intake_session.current_question_count == 0:
            # First question: use AI service to generate chief complaint question
            current_question = await self._question_service.generate_first_question(
                disease=visit.symptom or "general consultation"
            )
        else:
            # Subsequent questions: generate based on context
            previous_answers = [
                qa.answer for qa in visit.intake_session.questions_asked
            ]
            asked_questions = [
                qa.question for qa in visit.intake_session.questions_asked
            ]
            current_question = await self._question_service.generate_next_question(
                disease=visit.symptom,
                previous_answers=previous_answers,
                asked_questions=asked_questions,
                current_count=visit.intake_session.current_question_count,
                max_count=visit.intake_session.max_questions,
            )

        # Add the question and answer
        visit.add_question_answer(current_question, request.answer, attachment_image_path=request.attachment_image_path)
        # If this is the first answer, set the visit.symptom from patient's response
        if visit.symptom == "" and visit.intake_session.current_question_count == 1:
            visit.symptom = request.answer.strip()

        # Check if we should stop asking questions
        should_stop = await self._question_service.should_stop_asking(
            disease=visit.symptom,
            previous_answers=[qa.answer for qa in visit.intake_session.questions_asked],
            current_count=visit.intake_session.current_question_count,
            max_count=visit.intake_session.max_questions,
        )

        next_question = None
        is_complete = False

        # Enforce minimum of 3 questions before completion unless service decides to stop after >=3
        min_questions_required = 3
        reached_minimum = visit.intake_session.current_question_count >= min_questions_required

        if (should_stop and reached_minimum) or not visit.can_ask_more_questions():
            # Complete the intake
            visit.complete_intake()
            is_complete = True
            message = "Intake completed successfully. Ready for next step."
        else:
            # Generate next question for the NEXT round (not current)
            previous_answers = [
                qa.answer for qa in visit.intake_session.questions_asked
            ]
            asked_questions = [
                qa.question for qa in visit.intake_session.questions_asked
            ]
            next_question = await self._question_service.generate_next_question(
                disease=visit.symptom,
                previous_answers=previous_answers,
                asked_questions=asked_questions,
                current_count=visit.intake_session.current_question_count,
                max_count=visit.intake_session.max_questions,
            )
            message = (
                f"Question {visit.intake_session.current_question_count + 1} "
                f"of {visit.intake_session.max_questions}"
            )

        # Save the updated patient
        await self._patient_repository.save(patient)

        # Raise domain events
        # Note: In a real implementation, you'd have an event bus

        # Check if next question allows image upload
        allows_image_upload = False
        if next_question:
            allows_image_upload = self._question_service.is_medication_question(next_question)

        return AnswerIntakeResponse(
            next_question=next_question,
            is_complete=is_complete,
            question_count=visit.intake_session.current_question_count,
            max_questions=visit.intake_session.max_questions,
            message=message,
            allows_image_upload=allows_image_upload,
        )