"""FastAPI dependency providers.

Formatting-only changes; behavior preserved.
"""

from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from clinicai.adapters.db.mongo.repositories.patient_repository import (
    MongoPatientRepository,
)
from clinicai.adapters.db.mongo.repositories.stable_patient_repository import (
    MongoStablePatientRepository,
)
from clinicai.adapters.external.question_service_openai import OpenAIQuestionService
from clinicai.application.ports.repositories.patient_repo import PatientRepository
from clinicai.application.ports.repositories.stable_patient_repo import (
    StablePatientRepository,
)
from clinicai.application.ports.services.question_service import QuestionService


@lru_cache()
def get_patient_repository() -> PatientRepository:
    """Get patient repository instance."""
    # In a real implementation, this would come from the DI container
    # For now, we'll create it directly
    return MongoPatientRepository()


@lru_cache()
def get_question_service() -> QuestionService:
    """Get question service instance."""
    # In a real implementation, this would come from the DI container
    # For now, we'll create it directly
    return OpenAIQuestionService()


@lru_cache()
def get_stable_patient_repository() -> StablePatientRepository:
    """Get stable patient repository instance."""
    # In a real implementation, this would come from the DI container
    # For now, we'll create it directly
    return MongoStablePatientRepository()


# Dependency annotations for FastAPI
PatientRepositoryDep = Annotated[PatientRepository, Depends(get_patient_repository)]
QuestionServiceDep = Annotated[QuestionService, Depends(get_question_service)]
StablePatientRepositoryDep = Annotated[
    StablePatientRepository, Depends(get_stable_patient_repository)
]
