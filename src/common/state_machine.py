"""The application state model from SRS appendix A.

FR-6.6. A transition that is not listed here is refused, and the refusal names
the current status and what can be reached from it, which is what the validation
table in section 3.11 asks for.
"""
from typing import Dict, List, Optional, Set

from common.errors import InvalidTransitionError

SUBMITTED = "SUBMITTED"
UNDER_REVIEW = "UNDER_REVIEW"
INTERVIEW_SCHEDULED = "INTERVIEW_SCHEDULED"
OFFER_EXTENDED = "OFFER_EXTENDED"
OFFER_ACCEPTED = "OFFER_ACCEPTED"
OFFER_DECLINED = "OFFER_DECLINED"
REJECTED = "REJECTED"
WITHDRAWN = "WITHDRAWN"

ALL_STATUSES: Set[str] = {
    SUBMITTED,
    UNDER_REVIEW,
    INTERVIEW_SCHEDULED,
    OFFER_EXTENDED,
    OFFER_ACCEPTED,
    OFFER_DECLINED,
    REJECTED,
    WITHDRAWN,
}

FINAL_STATUSES: Set[str] = {OFFER_ACCEPTED, OFFER_DECLINED, REJECTED, WITHDRAWN}

# Who may make each move. A recruiter runs the pipeline; the applicant answers an
# offer and may withdraw. FR-6.3, FR-6.4 and FR-6.5.
RECRUITER_TRANSITIONS: Dict[str, Set[str]] = {
    SUBMITTED: {UNDER_REVIEW, REJECTED},
    UNDER_REVIEW: {INTERVIEW_SCHEDULED, OFFER_EXTENDED, REJECTED},
    INTERVIEW_SCHEDULED: {OFFER_EXTENDED, REJECTED},
    OFFER_EXTENDED: {REJECTED},
}

APPLICANT_TRANSITIONS: Dict[str, Set[str]] = {
    SUBMITTED: {WITHDRAWN},
    UNDER_REVIEW: {WITHDRAWN},
    INTERVIEW_SCHEDULED: {WITHDRAWN},
    OFFER_EXTENDED: {OFFER_ACCEPTED, OFFER_DECLINED, WITHDRAWN},
}


def allowed_next(current: str, actor_role: str) -> Set[str]:
    table = RECRUITER_TRANSITIONS if actor_role == "RECRUITER" else APPLICANT_TRANSITIONS
    return table.get(current, set())


def assert_transition(current: str, target: str, actor_role: str) -> None:
    if target not in ALL_STATUSES:
        raise InvalidTransitionError(
            f"{target} is not a status this system recognises.",
            {"currentStatus": current},
        )
    if current in FINAL_STATUSES:
        raise InvalidTransitionError(
            f"This application is already {_humanise(current)} and cannot change again.",
            {"currentStatus": current, "allowedNext": []},
        )
    options = allowed_next(current, actor_role)
    if target not in options:
        raise InvalidTransitionError(
            f"An application that is {_humanise(current)} cannot move to "
            f"{_humanise(target)}.",
            {"currentStatus": current, "allowedNext": sorted(options)},
        )


def _humanise(status: str) -> str:
    return status.replace("_", " ").lower()


def history_entry(status: str, actor_id: str, note: str = "") -> Dict[str, str]:
    from common.time_utils import now_iso

    entry = {"status": status, "changedBy": actor_id, "timestamp": now_iso()}
    if note:
        entry["note"] = note[:500]
    return entry


def status_before_rejection(history: List[Dict[str, str]]) -> Optional[str]:
    """Where an application stood just before it was rejected.

    Reinstating restores that status rather than guessing one, so an application
    rejected out of an interview goes back to its interview rather than to the
    bottom of the funnel. The history is the record, so it is also the answer.

    None when the rejection is the first entry, which should not happen but is
    cheaper to handle than to rule out: the caller falls back to UNDER_REVIEW,
    since a recruiter has by definition already opened it.
    """
    for index in range(len(history) - 1, -1, -1):
        if history[index].get("status") == REJECTED:
            return history[index - 1].get("status") if index > 0 else None
    return None


def funnel_counts(statuses: List[str]) -> Dict[str, int]:
    counts = {status: 0 for status in sorted(ALL_STATUSES)}
    for status in statuses:
        if status in counts:
            counts[status] += 1
    return counts
