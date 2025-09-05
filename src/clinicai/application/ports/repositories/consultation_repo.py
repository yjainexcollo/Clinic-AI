from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List, Optional

# Note: Repository uses domain entities directly; DTOs are not required here.
from ....domain.entities.visit import Visit
from ....domain.value_objects.visit_id import VisitId


class ConsultationRepository(ABC):
	"""Repository interface for persisting and retrieving consultations (visits)."""

	@abstractmethod
	async def save(self, visit: Visit) -> Visit:
		"""Create or update a consultation (visit)."""
		pass

	@abstractmethod
	async def find_by_id(self, visit_id: VisitId) -> Optional[Visit]:
		"""Find a consultation by its ID."""
		pass

	@abstractmethod
	async def find_by_patient(self, patient_id: str, limit: int = 100, offset: int = 0) -> List[Visit]:
		"""List consultations for a given patient with pagination."""
		pass

	@abstractmethod
	async def delete(self, visit_id: VisitId) -> bool:
		"""Delete a consultation by its ID."""
		pass
