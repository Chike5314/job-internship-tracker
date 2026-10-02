"""Payload validation.

FR-11.1 and the validation table in SRS section 3.11. A failed validation names
every field that failed rather than only the first one, because an interface
that reveals one problem at a time makes a form take as many round trips as it
has mistakes.
"""
import re
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence
from urllib.parse import urlparse

from common.errors import ValidationError

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")
ISO_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?")

OPPORTUNITY_TYPES = {
    "FULL_TIME_JOB",
    "PROFESSIONAL_INTERNSHIP",
    "ACADEMIC_INTERNSHIP",
}
WORK_MODALITIES = {"ONSITE", "HYBRID", "REMOTE"}
POSTING_STATUSES = {"DRAFT", "PUBLISHED", "CLOSED", "EXPIRED"}
VERIFICATION_STATUSES = {"PENDING_VERIFICATION", "VERIFIED", "REJECTED", "SUSPENDED"}
EXPERIENCE_LEVELS = {"ENTRY", "MID", "SENIOR"}
INTERVIEW_MODES = {"ONSITE", "ONLINE"}

ALLOWED_DOCUMENT_EXTENSIONS = {"pdf", "doc", "docx"}
ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png"}


class Errors:
    """Collects field failures so they can be reported together."""

    def __init__(self) -> None:
        self._fields: Dict[str, str] = {}

    def add(self, field: str, message: str) -> None:
        self._fields.setdefault(field, message)

    def raise_if_any(self, message: str = "Some fields need attention.") -> None:
        if self._fields:
            raise ValidationError(
                message,
                {"fields": [{"field": k, "message": v} for k, v in self._fields.items()]},
            )


def require_string(
    errors: Errors,
    data: Dict[str, Any],
    field: str,
    *,
    max_length: int = 2000,
    min_length: int = 1,
) -> Optional[str]:
    value = data.get(field)
    if not isinstance(value, str) or not value.strip():
        errors.add(field, "This field is required.")
        return None
    value = value.strip()
    if len(value) < min_length:
        errors.add(field, f"Must be at least {min_length} characters.")
        return None
    if len(value) > max_length:
        errors.add(field, f"Must be {max_length} characters or fewer.")
        return None
    return value


def optional_string(
    data: Dict[str, Any], field: str, *, max_length: int = 2000
) -> Optional[str]:
    value = data.get(field)
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        return None
    return value.strip()[:max_length]


def require_enum(
    errors: Errors, data: Dict[str, Any], field: str, allowed: Iterable[str]
) -> Optional[str]:
    allowed = set(allowed)
    value = data.get(field)
    if value not in allowed:
        errors.add(field, "Must be one of: " + ", ".join(sorted(allowed)) + ".")
        return None
    return value


def optional_enum(
    errors: Errors, data: Dict[str, Any], field: str, allowed: Iterable[str]
) -> Optional[str]:
    if data.get(field) in (None, ""):
        return None
    return require_enum(errors, data, field, allowed)


def require_email(errors: Errors, data: Dict[str, Any], field: str) -> Optional[str]:
    value = require_string(errors, data, field, max_length=254)
    if value is None:
        return None
    if not EMAIL_PATTERN.match(value):
        errors.add(field, "Enter a valid email address.")
        return None
    return value.lower()


def require_https_url(errors: Errors, data: Dict[str, Any], field: str) -> Optional[str]:
    """FR-3.6. A company website has to be a well formed HTTPS URL."""
    value = require_string(errors, data, field, max_length=512)
    if value is None:
        return None
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc or "." not in parsed.netloc:
        errors.add(field, "Enter a full website address beginning with https://.")
        return None
    return value


def optional_url(data: Dict[str, Any], field: str) -> Optional[str]:
    value = optional_string(data, field, max_length=1024)
    if value is None:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    return value


def optional_iso_datetime(
    errors: Errors, data: Dict[str, Any], field: str
) -> Optional[str]:
    value = data.get(field)
    if value in (None, ""):
        return None
    if not isinstance(value, str) or not ISO_DATE_PATTERN.match(value):
        errors.add(field, "Use an ISO-8601 date, for example 2026-03-01.")
        return None
    return value


def optional_int(
    errors: Errors,
    data: Dict[str, Any],
    field: str,
    *,
    minimum: int = 0,
    maximum: int = 1_000_000,
) -> Optional[int]:
    value = data.get(field)
    if value in (None, ""):
        return None
    try:
        number = int(value)
    except (TypeError, ValueError):
        errors.add(field, "Enter a whole number.")
        return None
    if number < minimum or number > maximum:
        errors.add(field, f"Enter a number between {minimum} and {maximum}.")
        return None
    return number


def optional_string_list(
    data: Dict[str, Any], field: str, *, limit: int = 40, item_length: int = 80
) -> Optional[List[str]]:
    value = data.get(field)
    if value is None:
        return None
    if not isinstance(value, list):
        return None
    cleaned = [
        str(item).strip()[:item_length]
        for item in value[:limit]
        if str(item).strip()
    ]
    return cleaned


def validate_label_value_pairs(
    errors: Errors, data: Dict[str, Any], field: str, *, limit: int = 20
) -> Optional[List[Dict[str, str]]]:
    """FR-4.14. Free label and value pairs the recruiter adds to a posting.

    These are displayed and never filtered, so they are validated for shape and
    length and nothing else.
    """
    value = data.get(field)
    if value is None:
        return None
    if not isinstance(value, list):
        errors.add(field, "Send a list of label and value pairs.")
        return None
    if len(value) > limit:
        errors.add(field, f"At most {limit} additional details are allowed.")
        return None
    pairs: List[Dict[str, str]] = []
    for index, item in enumerate(value):
        if not isinstance(item, dict):
            errors.add(f"{field}[{index}]", "Each entry needs a label and a value.")
            continue
        label = str(item.get("label", "")).strip()[:80]
        detail = str(item.get("value", "")).strip()[:500]
        if not label or not detail:
            errors.add(f"{field}[{index}]", "Each entry needs a label and a value.")
            continue
        pairs.append({"label": label, "value": detail})
    return pairs


def validate_salary(errors: Errors, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """FR-4.13. Optional, but coherent when it is supplied."""
    value = data.get("salary")
    if value in (None, {}):
        return None
    if not isinstance(value, dict):
        errors.add("salary", "Send an object with min, max, currency and period.")
        return None

    disclosed = bool(value.get("disclosed", True))
    if not disclosed:
        return {"disclosed": False}

    minimum = optional_int(errors, value, "min", minimum=0, maximum=100_000_000)
    maximum = optional_int(errors, value, "max", minimum=0, maximum=100_000_000)
    currency = str(value.get("currency", "")).strip().upper()[:3]
    period = str(value.get("period", "")).strip().upper()

    if minimum is None and maximum is None:
        errors.add("salary", "Give at least a minimum or a maximum, or mark it undisclosed.")
        return None
    if minimum is not None and maximum is not None and minimum > maximum:
        errors.add("salary", "The minimum cannot be above the maximum.")
        return None
    if len(currency) != 3:
        errors.add("salary.currency", "Use a three letter currency code, for example XAF.")
        return None
    if period not in {"HOUR", "MONTH", "YEAR"}:
        errors.add("salary.period", "Must be HOUR, MONTH or YEAR.")
        return None

    return {
        "disclosed": True,
        "min": minimum,
        "max": maximum,
        "currency": currency,
        "period": period,
    }


def file_extension(file_name: str) -> str:
    return file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""


def validate_upload_request(
    errors: Errors,
    data: Dict[str, Any],
    *,
    image_allowed: bool,
    max_bytes: int,
) -> Dict[str, Any]:
    """FR-5.8. Type and size are checked before a presigned URL is handed out."""
    file_name = require_string(errors, data, "fileName", max_length=255) or ""
    size = optional_int(errors, data, "fileSize", minimum=1, maximum=max_bytes * 4)

    extension = file_extension(file_name)
    allowed = set(ALLOWED_DOCUMENT_EXTENSIONS)
    if image_allowed:
        allowed |= ALLOWED_IMAGE_EXTENSIONS
    if extension and extension not in allowed:
        errors.add(
            "fileName",
            "Allowed file types are " + ", ".join(sorted(allowed)) + ".",
        )
    if size is not None and size > max_bytes:
        errors.add("fileSize", "Files must be ten megabytes or smaller.")

    return {"fileName": file_name, "extension": extension, "fileSize": size}


def coerce_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return default


def apply_if_present(
    target: Dict[str, Any],
    source: Dict[str, Any],
    field: str,
    transform: Callable[[Any], Any] = lambda v: v,
) -> None:
    if field in source:
        target[field] = transform(source[field])


def ensure_not_empty(values: Sequence[Any], message: str) -> None:
    if not values:
        raise ValidationError(message)
