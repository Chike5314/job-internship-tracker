"""Tests for what puts an application on the company calendar, and takes it off.

FR-13.8. CompanyInterviewIndex is sparse, so these two fields are the whole
mechanism: present means the row is on the calendar, absent means it is not.
"""
import os
import sys
from datetime import timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from common import interviews  # noqa: E402
from common.time_utils import now  # noqa: E402


def stamp(days: float) -> str:
    moment = now() + timedelta(days=days)
    return moment.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def entry(days: float, state: str = "PROPOSED", identifier: str = "int_1"):
    return {
        "interviewId": identifier,
        "scheduledAt": stamp(days),
        "durationMinutes": 60,
        "mode": "ONLINE",
        "locationOrLink": "https://example.com/room",
        "state": state,
        "proposedBy": "rec_1",
    }


def test_a_scheduled_interview_puts_the_application_on_the_calendar():
    to_set, to_remove = interviews.calendar_fields([entry(3)], "INTERVIEW_SCHEDULED")
    assert to_remove == []
    # The sort key is the interview time, compared on the date rather than to the
    # millisecond so the test does not depend on how long it took to run.
    assert to_set["nextInterviewAt"][:10] == stamp(3)[:10]
    assert to_set["nextInterview"]["mode"] == "ONLINE"


def test_the_earliest_upcoming_interview_wins():
    later = entry(9, identifier="int_late")
    sooner = entry(2, identifier="int_soon")
    to_set, _ = interviews.calendar_fields([later, sooner], "INTERVIEW_SCHEDULED")
    assert to_set["nextInterview"]["interviewId"] == "int_soon"


def test_a_cancelled_interview_leaves_the_calendar():
    to_set, to_remove = interviews.calendar_fields(
        [entry(3, state="CANCELLED")], "INTERVIEW_SCHEDULED"
    )
    assert to_set == {}
    assert set(to_remove) == {"nextInterviewAt", "nextInterview"}


def test_a_declined_interview_leaves_the_calendar():
    _, to_remove = interviews.calendar_fields(
        [entry(3, state="DECLINED")], "INTERVIEW_SCHEDULED"
    )
    assert to_remove


def test_a_reschedule_shows_the_new_time_and_not_the_old_one():
    """The old entry is cancelled in place and the new one appended."""
    history = [
        entry(2, state="CANCELLED", identifier="int_old"),
        entry(6, identifier="int_new"),
    ]
    to_set, _ = interviews.calendar_fields(history, "INTERVIEW_SCHEDULED")
    assert to_set["nextInterview"]["interviewId"] == "int_new"


def test_an_interview_already_past_leaves_the_calendar():
    _, to_remove = interviews.calendar_fields([entry(-1)], "INTERVIEW_SCHEDULED")
    assert to_remove


def test_a_final_status_leaves_the_calendar_even_with_a_future_interview():
    for status in ("REJECTED", "WITHDRAWN", "OFFER_ACCEPTED", "OFFER_DECLINED"):
        _, to_remove = interviews.calendar_fields([entry(4)], status)
        assert to_remove, status


def test_an_offer_extended_after_the_interview_keeps_it_visible():
    """An offer is not a final status, so an interview still ahead stays on."""
    to_set, _ = interviews.calendar_fields([entry(4)], "OFFER_EXTENDED")
    assert to_set


def test_an_application_with_no_interview_is_never_on_the_calendar():
    to_set, to_remove = interviews.calendar_fields(None, "SUBMITTED")
    assert to_set == {}
    assert to_remove


def test_the_snapshot_carries_only_what_a_calendar_row_shows():
    captured = interviews.snapshot(entry(3))
    assert set(captured) == {
        "interviewId",
        "scheduledAt",
        "durationMinutes",
        "mode",
        "locationOrLink",
        "state",
    }
    assert "proposedBy" not in captured
