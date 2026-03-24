"""
Datetime helpers for safe UTC parsing and comparison.
"""

from datetime import datetime, timezone
from typing import Any, Optional


def utc_now() -> datetime:
    """Return current time as timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


def parse_datetime_utc(value: Any) -> Optional[datetime]:
    """
    Parse datetime input and normalize to timezone-aware UTC.

    Accepts ISO datetime strings or datetime objects.
    Naive datetimes are treated as UTC.
    """
    if value is None:
        return None

    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        normalized = value.strip()
        if normalized.endswith("Z"):
            normalized = normalized[:-1] + "+00:00"
        dt = datetime.fromisoformat(normalized)
    else:
        return None

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(timezone.utc)


def is_future_datetime(value: Any) -> bool:
    """Return True when the provided datetime value is in the future."""
    dt = parse_datetime_utc(value)
    return bool(dt and dt > utc_now())
