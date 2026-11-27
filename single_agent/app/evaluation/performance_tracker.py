"""
PHANTOM — Performance Tracker
Tracks timing and resource usage across the investigation workflow.
"""
from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from typing import Any, Dict, Generator, Optional

logger = logging.getLogger(__name__)


class PerformanceTracker:
    """Tracks execution time segments."""

    def __init__(self) -> None:
        self._segments: Dict[str, float] = {}
        self._start_times: Dict[str, float] = {}

    def start(self, segment: str) -> None:
        self._start_times[segment] = time.perf_counter()

    def stop(self, segment: str) -> float:
        if segment not in self._start_times:
            return 0.0
        elapsed = time.perf_counter() - self._start_times.pop(segment)
        self._segments[segment] = elapsed
        return elapsed

    @contextmanager
    def track(self, segment: str) -> Generator[None, None, None]:
        self.start(segment)
        try:
            yield
        finally:
            elapsed = self.stop(segment)
            logger.debug(f"[{segment}] {elapsed:.3f}s")

    def get_summary(self) -> Dict[str, float]:
        return dict(self._segments)

    def total_time(self) -> float:
        return sum(self._segments.values())
