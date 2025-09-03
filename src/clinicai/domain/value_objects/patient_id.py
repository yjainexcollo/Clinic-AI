"""
Patient ID value object for type-safe patient identification.
Format: CLINIC01_{patient_name}_{patient_phone_number}
"""

import re
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class PatientId:
    """Immutable patient identifier value object."""

    value: str

    def __post_init__(self) -> None:
        """Validate patient ID format."""
        if not self.value:
            raise ValueError("Patient ID cannot be empty")

        if not isinstance(self.value, str):
            raise ValueError("Patient ID must be a string")

        # Validate format: CLINIC01_{patient_name}_{patient_phone_number}
        pattern = r"^CLINIC01_[a-zA-Z0-9_]+_\d+$"
        if not re.match(pattern, self.value):
            raise ValueError(
                "Patient ID must follow format: CLINIC01_{patient_name}_{patient_phone_number}"
            )

    def __str__(self) -> str:
        """String representation."""
        return self.value

    def __eq__(self, other: Any) -> bool:
        """Equality comparison."""
        if not isinstance(other, PatientId):
            return False
        return self.value == other.value

    def __hash__(self) -> int:
        """Hash for use in sets and dictionaries."""
        return hash(self.value)

    @classmethod
    def generate(cls, patient_name: str, phone_number: str) -> "PatientId":
        """Generate a new patient ID from name and phone."""
        # Clean and format the name (remove spaces, special chars, convert to uppercase)
        clean_name = re.sub(r"[^a-zA-Z0-9]", "", patient_name).upper()
        if not clean_name:
            raise ValueError(
                "Patient name must contain at least one alphanumeric character"
            )

        # Clean phone number (remove all non-digits)
        clean_phone = re.sub(r"\D", "", phone_number)
        if not clean_phone:
            raise ValueError("Phone number must contain at least one digit")

        return cls(f"CLINIC01_{clean_name}_{clean_phone}")
