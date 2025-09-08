"""Stable Patient repository interface for repeat intake logic."""

from abc import ABC, abstractmethod
from typing import List, Optional

from ....domain.entities.stable_patient import StablePatient
from ....domain.entities.stable_visit import StableVisit
from ....domain.value_objects.idempotency_key import IdempotencyKey
from ....domain.value_objects.stable_patient_id import StablePatientId
from ....domain.value_objects.stable_visit_id import StableVisitId


class StablePatientRepository(ABC):
    """Abstract repository for stable patient data access."""

    @abstractmethod
    async def save_patient(self, patient: StablePatient) -> StablePatient:
        """Save a patient to the repository."""
        pass

    @abstractmethod
    async def find_patient_by_id(
        self, patient_id: StablePatientId
    ) -> Optional[StablePatient]:
        """Find a patient by ID."""
        pass

    @abstractmethod
    async def find_patient_by_normalized_data(
        self, name_normalized: str, phone_normalized: str
    ) -> Optional[StablePatient]:
        """Find a patient by normalized name and phone."""
        pass

    @abstractmethod
    async def find_or_create_patient(
        self, name: str, phone_e164: str, age: Optional[int] = None
    ) -> tuple[StablePatient, bool]:
        """
        Find existing patient or create new one.

        Returns:
            Tuple of (patient, is_new_patient)
        """
        pass

    @abstractmethod
    async def add_visit_to_patient(
        self, patient_id: StablePatientId, visit: StableVisit
    ) -> StableVisit:
        """Add a visit to an existing patient atomically."""
        pass

    @abstractmethod
    async def get_patient_visits(
        self, patient_id: StablePatientId, limit: int = 100, offset: int = 0
    ) -> List[StableVisit]:
        """Get patient's visit history."""
        pass

    @abstractmethod
    async def find_visit_by_id(self, visit_id: StableVisitId) -> Optional[StableVisit]:
        """Find a visit by ID."""
        pass

    @abstractmethod
    async def update_visit(self, visit: StableVisit) -> StableVisit:
        """Update a visit."""
        pass

    @abstractmethod
    async def save_idempotency_record(
        self,
        idempotency_key: IdempotencyKey,
        patient_id: StablePatientId,
        visit_id: StableVisitId,
    ) -> None:
        """Save an idempotency record."""
        pass

    @abstractmethod
    async def find_idempotency_record(
        self, idempotency_key: IdempotencyKey
    ) -> Optional[tuple[StablePatientId, StableVisitId]]:
        """Find an idempotency record."""
        pass

    @abstractmethod
    async def cleanup_expired_idempotency_records(self) -> int:
        """Clean up expired idempotency records."""
        pass
