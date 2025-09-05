"""
Composition root: dependency wiring and adapter selection.
"""

from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from .core.config import get_settings
from .core.container import register_singleton, ServiceNames
from .adapters.db.mongo.repositories.patient_repository import MongoPatientRepository
from .adapters.db.mongo.repositories.consultation_repository import MongoConsultationRepository
from .adapters.db.mongo.models.patient_m import PatientMongo
from .adapters.db.mongo.models.consultation_m import ConsultationMongo
from .adapters.db.mongo.models.stable_patient_m import StablePatientMongo, IdempotencyRecordMongo


async def initialize_database() -> None:
	"""Initialize MongoDB (Beanie) and register repositories."""
	settings = get_settings()
	client = AsyncIOMotorClient(settings.database.uri)
	db = client[settings.database.db_name]

	await init_beanie(
		database=db,
		document_models=[PatientMongo, ConsultationMongo, StablePatientMongo, IdempotencyRecordMongo],
	)

	# Register repositories
	register_singleton(ServiceNames.PATIENT_REPOSITORY, MongoPatientRepository())
	register_singleton(ServiceNames.CONSULTATION_REPOSITORY, MongoConsultationRepository())
