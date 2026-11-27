"""
PHANTOM — Case Creator
Wraps anomaly detector output and prioritizes cases for investigation.
"""
from __future__ import annotations

import logging
from typing import List, Optional

from app.models.case import AnomalyCategory, InvestigationCase, SeverityLevel

logger = logging.getLogger(__name__)


SEVERITY_PRIORITY = {
    SeverityLevel.CRITICAL: 4,
    SeverityLevel.HIGH: 3,
    SeverityLevel.MEDIUM: 2,
    SeverityLevel.LOW: 1,
}


def prioritize_cases(
    cases: List[InvestigationCase],
    max_cases: int = 50,
    min_severity: SeverityLevel = SeverityLevel.MEDIUM,
) -> List[InvestigationCase]:
    """
    Filter and prioritize cases by severity for the investigation queue.
    - Only cases at or above min_severity are included.
    - Cases are sorted: highest severity first, then by detection rule.
    - Returns at most max_cases.
    """
    min_priority = SEVERITY_PRIORITY[min_severity]
    filtered = [
        c for c in cases
        if SEVERITY_PRIORITY.get(SeverityLevel(c.severity), 0) >= min_priority
    ]
    filtered.sort(
        key=lambda c: (-SEVERITY_PRIORITY.get(SeverityLevel(c.severity), 0), c.detection_rule),
    )
    result = filtered[:max_cases]
    logger.info(
        f"Case prioritization: {len(cases)} total → {len(filtered)} above threshold "
        f"→ {len(result)} selected (max={max_cases})"
    )
    return result
