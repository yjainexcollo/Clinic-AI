"""Stable Patient ID value object for repeat intake logic.

Uses human-readable format derived from patient name and phone.
"""

from dataclasses import dataclass
from typing import Any

from ...core.utils.patient_matching import generate_patient_id


@dataclass(frozen=True)
class StablePatientId:
    """Immutable stable patient identifier value object."""

    value: str

    def __post_init__(self) -> None:
        """Validate patient ID format."""
        if not self.value:
            raise ValueError("Patient ID cannot be empty")

        if not isinstance(self.value, str):
            raise ValueError("Patient ID must be a string")

    def __str__(self) -> str:
        """String representation."""
        return self.value

    def __eq__(self, other: Any) -> bool:
        """Equality comparison."""
        if not isinstance(other, StablePatientId):
            return False
        return self.value == other.value

    def __hash__(self) -> int:
        """Hash for use in sets and dictionaries."""
        return hash(self.value)

    @classmethod
    def generate(cls, name: str, phone: str) -> "StablePatientId":
        """Generate a new stable patient ID using {name}_{digits} format."""
        return cls(generate_patient_id(name, phone))

    @classmethod
    def from_string(cls, value: str) -> "StablePatientId":
        """Create from string value."""
        return cls(value)
