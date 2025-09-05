"""
MongoDB implementation of ConsultationRepository.
"""

from datetime import datetime
from typing import List, Optional

from clinicai.application.ports.repositories.consultation_repo import ConsultationRepository
from clinicai.domain.entities.visit import IntakeSession, QuestionAnswer, Visit
from clinicai.domain.value_objects.visit_id import VisitId
from clinicai.domain.value_objects.question_id import QuestionId

from ..models.consultation_m import ConsultationMongo, IntakeSessionMongo, QuestionAnswerMongo


class MongoConsultationRepository(ConsultationRepository):
	"""MongoDB implementation of ConsultationRepository."""

	async def save(self, visit: Visit) -> Visit:
		consultation_mongo = await self._domain_to_mongo(visit)
		await consultation_mongo.save()
		return await self._mongo_to_domain(consultation_mongo)

	async def find_by_id(self, visit_id: VisitId) -> Optional[Visit]:
		consultation = await ConsultationMongo.find_one(ConsultationMongo.consultation_id == visit_id.value)
		if not consultation:
			return None
		return await self._mongo_to_domain(consultation)

	async def find_by_patient(self, patient_id: str, limit: int = 100, offset: int = 0) -> List[Visit]:
		consultations = await ConsultationMongo.find(ConsultationMongo.patient_id == patient_id).skip(offset).limit(limit).to_list()
		return [await self._mongo_to_domain(c) for c in consultations]

	async def delete(self, visit_id: VisitId) -> bool:
		result = await ConsultationMongo.find_one(ConsultationMongo.consultation_id == visit_id.value).delete()
		return result is not None

	async def _domain_to_mongo(self, visit: Visit) -> ConsultationMongo:
		intake_session_mongo = None
		if visit.intake_session:
			questions_asked_mongo = []
			for qa in visit.intake_session.questions_asked:
				qa_mongo = QuestionAnswerMongo(
					question_id=qa.question_id.value,
					question=qa.question,
					answer=qa.answer,
					timestamp=qa.timestamp,
					question_number=qa.question_number,
				)
				questions_asked_mongo.append(qa_mongo)

			intake_session_mongo = IntakeSessionMongo(
				disease=visit.intake_session.disease,
				questions_asked=questions_asked_mongo,
				current_question_count=visit.intake_session.current_question_count,
				max_questions=visit.intake_session.max_questions,
				status=visit.intake_session.status,
				started_at=visit.intake_session.started_at,
				completed_at=visit.intake_session.completed_at,
			)

		# Check if exists
		existing = await ConsultationMongo.find_one(ConsultationMongo.consultation_id == visit.visit_id.value)
		if existing:
			existing.patient_id = visit.patient_id
			existing.disease = visit.disease
			existing.status = visit.status
			existing.created_at = visit.created_at
			existing.updated_at = datetime.utcnow()
			existing.intake_session = intake_session_mongo
			return existing

		return ConsultationMongo(
			consultation_id=visit.visit_id.value,
			patient_id=visit.patient_id,
			disease=visit.disease,
			status=visit.status,
			created_at=visit.created_at,
			updated_at=visit.updated_at,
			intake_session=intake_session_mongo,
		)

	async def _mongo_to_domain(self, consultation: ConsultationMongo) -> Visit:
		intake_session = None
		if consultation.intake_session:
			questions_asked = []
			for qa_mongo in consultation.intake_session.questions_asked:
				qa = QuestionAnswer(
					question_id=QuestionId(qa_mongo.question_id),
					question=qa_mongo.question,
					answer=qa_mongo.answer,
					timestamp=qa_mongo.timestamp,
					question_number=qa_mongo.question_number,
				)
				questions_asked.append(qa)

			intake_session = IntakeSession(
				disease=consultation.intake_session.disease,
				questions_asked=questions_asked,
				current_question_count=consultation.intake_session.current_question_count,
				max_questions=consultation.intake_session.max_questions,
				status=consultation.intake_session.status,
				started_at=consultation.intake_session.started_at,
				completed_at=consultation.intake_session.completed_at,
			)

		return Visit(
			visit_id=VisitId(consultation.consultation_id),
			patient_id=consultation.patient_id,
			disease=consultation.disease,
			status=consultation.status,
			created_at=consultation.created_at,
			updated_at=consultation.updated_at,
			intake_session=intake_session,
		)
