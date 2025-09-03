"""Stable Visit ID value object for repeat intake logic.

Uses UUID-based approach for better stability and uniqueness.
"""

import uuid
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class StableVisitId:
    """Immutable stable visit identifier value object."""

    value: str

    def __post_init__(self) -> None:
        """Validate visit ID format."""
        if not self.value:
            raise ValueError("Visit ID cannot be empty")

        if not isinstance(self.value, str):
            raise ValueError("Visit ID must be a string")

        # Validate UUID format
        try:
            uuid.UUID(self.value)
        except ValueError:
            raise ValueError("Visit ID must be a valid UUID")

    def __str__(self) -> str:
        """String representation."""
        return self.value

    def __eq__(self, other: Any) -> bool:
        """Equality comparison."""
        if not isinstance(other, StableVisitId):
            return False
        return self.value == other.value

    def __hash__(self) -> int:
        """Hash for use in sets and dictionaries."""
        return hash(self.value)

    @classmethod
    def generate(cls) -> "StableVisitId":
        """Generate a new stable visit ID using UUID4."""
        return cls(str(uuid.uuid4()))

    @classmethod
    def from_string(cls, value: str) -> "StableVisitId":
        """Create from string value."""
        return cls(value)
