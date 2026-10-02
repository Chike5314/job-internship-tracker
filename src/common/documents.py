"""Document requirements.

FR-4.15 and FR-5.1. Choosing an opportunity type pre fills a default set, which
the recruiter then adjusts. From that point on the posting is the only authority
on what an application must carry, so a posting that drops the authorisation
letter accepts applications without one.
"""
from typing import Any, Dict, List, Optional

from common.errors import MissingDocumentsError
from common.validation import Errors

# Keys are stable identifiers. Labels are what the applicant reads, and the
# recruiter may rename them.
CV = "cv"
COVER_LETTER = "coverLetter"
TRANSCRIPT = "transcript"
SCHOOL_AUTHORISATION = "schoolAuthorisation"
PORTFOLIO = "portfolio"
AVAILABILITY = "availability"

FILE_KEYS = {CV, COVER_LETTER, TRANSCRIPT, SCHOOL_AUTHORISATION}
TEXT_KEYS = {PORTFOLIO, AVAILABILITY}

DEFAULT_REQUIREMENTS: Dict[str, List[Dict[str, Any]]] = {
    "FULL_TIME_JOB": [
        {"key": CV, "label": "CV or resume", "required": True, "kind": "FILE"},
        {"key": COVER_LETTER, "label": "Cover letter", "required": True, "kind": "FILE"},
        {"key": PORTFOLIO, "label": "Portfolio links", "required": False, "kind": "TEXT"},
    ],
    "PROFESSIONAL_INTERNSHIP": [
        {"key": CV, "label": "CV or resume", "required": True, "kind": "FILE"},
        {"key": COVER_LETTER, "label": "Cover letter", "required": True, "kind": "FILE"},
        {
            "key": AVAILABILITY,
            "label": "Availability window",
            "required": True,
            "kind": "TEXT",
        },
    ],
    "ACADEMIC_INTERNSHIP": [
        {"key": CV, "label": "CV or resume", "required": True, "kind": "FILE"},
        {"key": COVER_LETTER, "label": "Cover letter", "required": True, "kind": "FILE"},
        {
            "key": TRANSCRIPT,
            "label": "Academic transcript",
            "required": True,
            "kind": "FILE",
        },
        {
            "key": SCHOOL_AUTHORISATION,
            "label": "School authorisation letter",
            "required": True,
            "kind": "FILE",
        },
    ],
}


def default_requirements(opportunity_type: str) -> List[Dict[str, Any]]:
    return [dict(item) for item in DEFAULT_REQUIREMENTS.get(opportunity_type, [])]


def normalise_requirements(
    errors: Errors, raw: Any, opportunity_type: str
) -> List[Dict[str, Any]]:
    """Accepts the recruiter's adjusted list, or falls back to the default set.

    A CV is always kept, because FR-5.10 asks for one on every application
    regardless of what else the posting wants.
    """
    if raw is None:
        return default_requirements(opportunity_type)
    if not isinstance(raw, list):
        errors.add("documentRequirements", "Send a list of document requirements.")
        return default_requirements(opportunity_type)
    if len(raw) > 15:
        errors.add("documentRequirements", "A posting may ask for at most 15 items.")
        return default_requirements(opportunity_type)

    cleaned: List[Dict[str, Any]] = []
    seen = set()
    for index, item in enumerate(raw):
        if not isinstance(item, dict):
            errors.add(f"documentRequirements[{index}]", "Each entry needs a key and a label.")
            continue
        key = str(item.get("key", "")).strip()[:40]
        label = str(item.get("label", "")).strip()[:120]
        kind = str(item.get("kind", "")).strip().upper() or (
            "TEXT" if key in TEXT_KEYS else "FILE"
        )
        if not key or not label:
            errors.add(f"documentRequirements[{index}]", "Each entry needs a key and a label.")
            continue
        if kind not in ("FILE", "TEXT"):
            errors.add(f"documentRequirements[{index}].kind", "Must be FILE or TEXT.")
            continue
        if key in seen:
            errors.add(f"documentRequirements[{index}].key", "This key is already used.")
            continue
        seen.add(key)
        cleaned.append(
            {
                "key": key,
                "label": label,
                "kind": kind,
                "required": bool(item.get("required", True)),
            }
        )

    if CV not in seen:
        cleaned.insert(
            0, {"key": CV, "label": "CV or resume", "kind": "FILE", "required": True}
        )
    return cleaned


def validate_submission(
    requirements: List[Dict[str, Any]],
    documents: Dict[str, str],
    answers: Dict[str, str],
) -> None:
    """FR-5.2. Every item the posting marks as required has to be present.

    The refusal carries the posting's whole requirement list, so the applicant
    sees everything outstanding rather than one item per attempt.
    """
    missing: List[Dict[str, Any]] = []
    for requirement in requirements:
        if not requirement.get("required"):
            continue
        key = requirement["key"]
        supplied = (
            documents.get(key) if requirement.get("kind", "FILE") == "FILE" else answers.get(key)
        )
        if not supplied:
            missing.append({"key": key, "label": requirement.get("label", key)})

    if missing:
        raise MissingDocumentsError(
            "This posting still needs some of the items below.",
            {"missing": missing, "requirements": requirements},
        )


def strip_unknown(
    requirements: List[Dict[str, Any]], supplied: Dict[str, Any], kind: str
) -> Dict[str, str]:
    """Keeps only what this posting actually asked for.

    Anything else a client sends is dropped rather than stored, so an
    application never carries a key nobody will read.
    """
    wanted = {
        req["key"] for req in requirements if req.get("kind", "FILE") == kind
    }
    return {
        key: str(value)[:2000]
        for key, value in (supplied or {}).items()
        if key in wanted and value
    }


def requirement_for(
    requirements: List[Dict[str, Any]], key: str
) -> Optional[Dict[str, Any]]:
    for requirement in requirements:
        if requirement.get("key") == key:
            return requirement
    return None
