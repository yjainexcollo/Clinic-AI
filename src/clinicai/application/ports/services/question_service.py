"""
Question service interface for AI-powered question generation.
"""

from abc import ABC, abstractmethod
from typing import List


class QuestionService(ABC):
    """Abstract service for generating adaptive questions."""

    @abstractmethod
    async def generate_first_question(self, disease: str) -> str:
        """Generate the first question based on disease/complaint."""
        pass

    @abstractmethod
    async def generate_next_question(
        self,
        disease: str,
        previous_answers: List[str],
        asked_questions: List[str],
        current_count: int,
        max_count: int,
    ) -> str:
        """Generate the next question based on context."""
        pass

    @abstractmethod
    async def should_stop_asking(
        self,
        disease: str,
        previous_answers: List[str],
        current_count: int,
        max_count: int,
    ) -> bool:
        """Determine if sufficient information has been collected."""
        pass
