"""Enhanced Patient domain entity for repeat intake logic with stable identity."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

if TYPE_CHECKING:
    from .stable_visit import StableVisit

from ...core.utils.patient_matching import (
    normalize_name,
    normalize_phone,
    normalize_phone_digits_only,
)
from ..errors import InvalidPatientDataError
from ..value_objects.stable_patient_id import StablePatientId


@dataclass
class StablePatient:
    """Enhanced Patient domain entity with stable identity for repeat intakes."""

    patient_id: StablePatientId
    name: str
    phone_e164: str
    age: Optional[int] = None
    gender: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    visits: List["StableVisit"] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    # Normalized fields for matching
    name_normalized: str = field(init=False)
    phone_normalized: str = field(init=False)

    def __post_init__(self) -> None:
        """Validate patient data and set normalized fields."""
        self._validate_patient_data()
        self.name_normalized = normalize_name(self.name)
        # Store digits-only normalization for matching, while keeping phone_e164 for storage/display
        self.phone_normalized = normalize_phone_digits_only(self.phone_e164)

    def _validate_patient_data(self) -> None:
        """Validate patient data according to business rules."""
        # Validate name
        if not self.name or len(self.name.strip()) < 2:
            raise InvalidPatientDataError("name", self.name)

        if len(self.name) > 80:
            raise InvalidPatientDataError("name", "Name too long (max 80 characters)")

        # Validate phone
        if not self.phone_e164 or not self.phone_e164.startswith("+"):
            raise InvalidPatientDataError("phone_e164", "Phone must be in E.164 format")

        # Validate age if provided
        if self.age is not None and (self.age < 0 or self.age > 120):
            raise InvalidPatientDataError("age", self.age)

    def add_visit(self, visit: "StableVisit") -> None:
        """Add a new visit to the patient's history."""
        self.visits.append(visit)
        self.updated_at = datetime.utcnow()

    def get_latest_visit(self) -> Optional["StableVisit"]:
        """Get the most recent visit."""
        if not self.visits:
            return None
        return max(self.visits, key=lambda v: v.created_at)

    def get_visit_by_id(self, visit_id: str) -> Optional["StableVisit"]:
        """Get visit by visit ID."""
        for visit in self.visits:
            if visit.visit_id.value == visit_id:
                return visit
        return None

    def has_active_intake(self) -> bool:
        """Check if patient has an active intake session."""
        latest_visit = self.get_latest_visit()
        if not latest_visit:
            return False
        return latest_visit.status == "open"

    def get_visit_history(self) -> List["StableVisit"]:
        """Get chronological visit history."""
        return sorted(self.visits, key=lambda v: v.created_at, reverse=True)

    def update_demographics(
        self,
        name: Optional[str] = None,
        age: Optional[int] = None,
        gender: Optional[str] = None,
        date_of_birth: Optional[datetime] = None,
    ) -> None:
        """Update patient demographics."""
        if name is not None:
            if not name or len(name.strip()) < 2:
                raise InvalidPatientDataError("name", name)
            self.name = name
            self.name_normalized = normalize_name(name)

        if age is not None:
            if age < 0 or age > 120:
                raise InvalidPatientDataError("age", age)
            self.age = age

        if gender is not None:
            self.gender = gender

        if date_of_birth is not None:
            self.date_of_birth = date_of_birth

        self.updated_at = datetime.utcnow()

    def is_valid_for_consultation(self) -> bool:
        """Check if patient can start a new consultation."""
        return bool(self.name and self.phone_e164)

    def get_patient_summary(self) -> dict:
        """Get patient summary for API responses."""
        return {
            "patient_id": self.patient_id.value,
            "name": self.name,
            "phone_e164": self.phone_e164,
            "age": self.age,
            "gender": self.gender,
            "total_visits": len(self.visits),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
