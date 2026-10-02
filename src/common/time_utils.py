"""Timestamps.

Everything stored is ISO-8601 in UTC so that lexical ordering on a sort key is
also chronological ordering, which is what the Notifications and Applications
indexes rely on.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional


def now() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def epoch_seconds(offset_days: int = 0) -> int:
    return int((now() + timedelta(days=offset_days)).timestamp())


def parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        # A bare date is accepted and read as midnight UTC, which is how a
        # deadline supplied as 2026-03-01 should behave.
        try:
            parsed = datetime.strptime(text[:10], "%Y-%m-%d")
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def is_past(value: Optional[str]) -> bool:
    parsed = parse_iso(value)
    return parsed is not None and parsed < now()


def hours_between(start: Optional[str], end: Optional[str]) -> Optional[float]:
    first, second = parse_iso(start), parse_iso(end)
    if first is None or second is None:
        return None
    return round((second - first).total_seconds() / 3600.0, 2)


def to_ical_stamp(value: Optional[str]) -> str:
    parsed = parse_iso(value) or now()
    return parsed.strftime("%Y%m%dT%H%M%SZ")
