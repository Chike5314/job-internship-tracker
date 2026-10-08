"""The two fields that put an application on a company's calendar.

FR-13.8. An interview lives inside the application it belongs to, which is the
right place for it but a poor place to read a calendar from: answering "what
does this company have next week" that way means walking every posting and then
every application under it.

So an application that has an interview still ahead of it carries two extra
fields, and CompanyInterviewIndex is keyed on them. Only applications with an
upcoming interview carry them, which makes the index sparse: a row appears when
an interview is scheduled and leaves on its own when the interview is cancelled,
declined, passes, or the application reaches a final status. A company's calendar
is then one ranged query that comes back already in time order.

The snapshot is a copy of the next interview rather than a pointer to it, so the
calendar needs no second read per row. It is safe to copy because it is rewritten
by the same call that changes the list it came from, and every one of those calls
goes through this module.
"""
from typing import Any, Dict, List, Optional, Tuple

from common.time_utils import now_iso

# The interview states that still expect somebody to turn up.
OPEN_STATES = {"PROPOSED", "CONFIRMED"}

# The application statuses where an interview no longer means anything.
CLOSED_STATUSES = {"OFFER_ACCEPTED", "OFFER_DECLINED", "REJECTED", "WITHDRAWN"}

AT_FIELD = "nextInterviewAt"
SNAPSHOT_FIELD = "nextInterview"


def next_interview(
    interviews: Optional[List[Dict[str, Any]]], status: str
) -> Optional[Dict[str, Any]]:
    """The earliest interview still ahead of now, or nothing."""
    if status in CLOSED_STATUSES or not interviews:
        return None

    moment = now_iso()
    upcoming = [
        interview
        for interview in interviews
        if interview.get("state") in OPEN_STATES
        and str(interview.get("scheduledAt") or "") > moment
    ]
    if not upcoming:
        return None
    return min(upcoming, key=lambda interview: str(interview.get("scheduledAt")))


def snapshot(interview: Dict[str, Any]) -> Dict[str, Any]:
    """Only the fields a calendar row actually shows."""
    return {
        key: interview[key]
        for key in (
            "interviewId",
            "scheduledAt",
            "durationMinutes",
            "mode",
            "locationOrLink",
            "state",
            "round",
            "roundLabel",
        )
        if key in interview
    }


def calendar_fields(
    interviews: Optional[List[Dict[str, Any]]], status: str
) -> Tuple[Dict[str, Any], List[str]]:
    """What to set and what to remove so the index matches the application.

    Returns a pair, because an application leaving the calendar has to have both
    fields removed rather than blanked. A key attribute written as an empty
    string still places the row in the index, which would leave a cancelled
    interview showing on the calendar.
    """
    upcoming = next_interview(interviews, status)
    if upcoming is None:
        return {}, [AT_FIELD, SNAPSHOT_FIELD]
    return (
        {AT_FIELD: upcoming.get("scheduledAt"), SNAPSHOT_FIELD: snapshot(upcoming)},
        [],
    )


def apply(table, application_id: str, interviews, status: str) -> None:
    """Writes the calendar fields for one application.

    Called after anything that could change whether an interview is still ahead:
    scheduling, rescheduling, cancelling, an applicant declining, and every
    status change including the ones made in bulk.
    """
    to_set, to_remove = calendar_fields(interviews, status)

    clauses: List[str] = []
    names: Dict[str, str] = {}
    values: Dict[str, Any] = {}

    if to_set:
        parts = []
        for index, (field, value) in enumerate(to_set.items()):
            names[f"#c{index}"] = field
            values[f":c{index}"] = value
            parts.append(f"#c{index} = :c{index}")
        clauses.append("SET " + ", ".join(parts))

    if to_remove:
        aliases = []
        for index, field in enumerate(to_remove):
            names[f"#d{index}"] = field
            aliases.append(f"#d{index}")
        clauses.append("REMOVE " + ", ".join(aliases))

    if not clauses:
        return

    kwargs: Dict[str, Any] = {
        "Key": {"applicationId": application_id},
        "UpdateExpression": " ".join(clauses),
        "ExpressionAttributeNames": names,
    }
    if values:
        kwargs["ExpressionAttributeValues"] = values
    table.update_item(**kwargs)
