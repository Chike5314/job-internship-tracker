"""The interview calendar, the notification centre, bulk actions and export.

The calendar tests are the ones worth having here rather than as unit tests: the
sparse index only behaves as intended if the attributes are actually written and
removed against a real table.
"""
from datetime import timedelta

import pytest

from conftest import call
from test_integration_applications import (
    APPLICANT,
    ADMIN,
    RECRUITER,
    app_handler,
    company_handler,
    jobs_handler,
    posting,  # noqa: F401 - used as a fixture
    submitted_application,
)


def notification_handler():
    from handlers.notification_service.handler import lambda_handler

    return lambda_handler


def in_days(days: float) -> str:
    from common.time_utils import now

    return (now() + timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def schedule(application_id, days=3.0, company="co_1"):
    return call(
        app_handler(),
        "POST",
        "/applications/{id}/interview",
        user=company,
        groups=RECRUITER,
        path={"id": application_id},
        body={
            "scheduledAt": in_days(days),
            "durationMinutes": 45,
            "mode": "ONLINE",
            "locationOrLink": "https://meet.example.com/abc",
        },
    )


def calendar(company="co_1", query=None):
    return call(
        jobs_handler(),
        "GET",
        "/companies/{id}/interviews",
        user=company,
        groups=RECRUITER,
        path={"id": company},
        query=query,
    )


# ----------------------------------------------------------------------
# Scheduling
# ----------------------------------------------------------------------
def test_scheduling_moves_the_application_and_returns_the_interview(posting):
    application_id = submitted_application(posting)
    status, payload = schedule(application_id)
    assert status == 201
    assert payload["status"] == "INTERVIEW_SCHEDULED"
    assert payload["interview"]["state"] == "PROPOSED"


def test_an_interview_in_the_past_is_refused(posting):
    application_id = submitted_application(posting)
    status, payload = schedule(application_id, days=-2)
    assert status == 400
    assert "past" in payload["error"]["message"]


def test_another_company_cannot_schedule_on_the_application(posting):
    application_id = submitted_application(posting)
    status, _ = schedule(application_id, company="co_2")
    assert status == 403


# ----------------------------------------------------------------------
# The calendar
# ----------------------------------------------------------------------
def test_a_scheduled_interview_appears_on_the_company_calendar(posting):
    application_id = submitted_application(posting)
    schedule(application_id, days=2)

    status, payload = calendar()
    assert status == 200
    assert payload["count"] == 1
    entry = payload["interviews"][0]
    assert entry["applicationId"] == application_id
    assert entry["jobTitle"] == "Backend Engineer"
    assert entry["mode"] == "ONLINE"
    assert entry["interviewState"] == "PROPOSED"


def test_the_calendar_is_in_time_order(posting):
    first = submitted_application(posting)
    schedule(first, days=6)

    # A second applicant on the same posting, scheduled earlier.
    _, upload = call(
        app_handler(),
        "POST",
        "/applications/upload-url",
        user="app_2",
        groups=APPLICANT,
        body={"jobId": posting, "documentKey": "cv", "fileName": "cv.pdf"},
    )
    _, submitted = call(
        app_handler(),
        "POST",
        "/applications",
        user="app_2",
        groups=APPLICANT,
        body={"jobId": posting, "documents": {"cv": upload["s3Key"]}},
    )
    second = submitted["application"]["applicationId"]
    schedule(second, days=2)

    _, payload = calendar()
    assert [entry["applicationId"] for entry in payload["interviews"]] == [second, first]


def test_the_window_excludes_interviews_outside_it(posting):
    application_id = submitted_application(posting)
    schedule(application_id, days=40)

    _, default_window = calendar()
    assert default_window["count"] == 0

    _, wide = calendar(query={"from": in_days(0), "to": in_days(60)})
    assert wide["count"] == 1


def test_cancelling_takes_the_interview_off_the_calendar(posting):
    application_id = submitted_application(posting)
    schedule(application_id, days=3)

    status, _ = call(
        app_handler(),
        "PATCH",
        "/applications/{id}/interview",
        user="co_1",
        groups=RECRUITER,
        path={"id": application_id},
        body={"action": "CANCEL"},
    )
    assert status == 200

    _, payload = calendar()
    assert payload["count"] == 0


def test_an_applicant_declining_takes_it_off_the_calendar(posting):
    application_id = submitted_application(posting)
    schedule(application_id, days=3)

    call(
        app_handler(),
        "PATCH",
        "/applications/{id}/interview",
        user="app_1",
        groups=APPLICANT,
        path={"id": application_id},
        body={"action": "DECLINE"},
    )
    _, payload = calendar()
    assert payload["count"] == 0


def test_confirming_keeps_it_on_the_calendar(posting):
    application_id = submitted_application(posting)
    schedule(application_id, days=3)

    call(
        app_handler(),
        "PATCH",
        "/applications/{id}/interview",
        user="app_1",
        groups=APPLICANT,
        path={"id": application_id},
        body={"action": "CONFIRM"},
    )
    _, payload = calendar()
    assert payload["count"] == 1
    assert payload["interviews"][0]["interviewState"] == "CONFIRMED"


def test_a_reschedule_shows_the_new_time_only(posting):
    application_id = submitted_application(posting)
    schedule(application_id, days=3)
    moved_to = in_days(8)

    call(
        app_handler(),
        "PATCH",
        "/applications/{id}/interview",
        user="co_1",
        groups=RECRUITER,
        path={"id": application_id},
        body={
            "action": "RESCHEDULE",
            "scheduledAt": moved_to,
            "mode": "ONSITE",
            "locationOrLink": "12 Rue Principale",
            "durationMinutes": 60,
        },
    )

    _, payload = calendar(query={"from": in_days(0), "to": in_days(30)})
    assert payload["count"] == 1
    assert payload["interviews"][0]["scheduledAt"] == moved_to
    assert payload["interviews"][0]["mode"] == "ONSITE"


def test_rejecting_the_application_takes_it_off_the_calendar(posting):
    application_id = submitted_application(posting)
    schedule(application_id, days=3)

    call(
        app_handler(),
        "PATCH",
        "/applications/{id}/status",
        user="co_1",
        groups=RECRUITER,
        path={"id": application_id},
        body={"status": "REJECTED"},
    )
    _, payload = calendar()
    assert payload["count"] == 0


def test_another_company_cannot_read_the_calendar(posting):
    status, _ = calendar(company="co_2")
    # co_2 is asking for co_1 only through its own id, so it sees its own empty
    # calendar rather than somebody else's.
    assert status == 200

    refused, _ = call(
        jobs_handler(),
        "GET",
        "/companies/{id}/interviews",
        user="co_2",
        groups=RECRUITER,
        path={"id": "co_1"},
    )
    assert refused == 403


# ----------------------------------------------------------------------
# Notification centre
# ----------------------------------------------------------------------
def test_a_company_sees_its_verification_notification(posting):
    status, payload = call(
        notification_handler(), "GET", "/notifications", user="co_1", groups=RECRUITER
    )
    assert status == 200
    assert payload["unreadCount"] >= 1
    assert any(
        item["type"] == "VERIFICATION_RESULT" for item in payload["notifications"]
    )


def test_marking_one_notification_read_lowers_the_count(posting):
    _, listed = call(
        notification_handler(), "GET", "/notifications", user="co_1", groups=RECRUITER
    )
    before = listed["unreadCount"]
    target = listed["notifications"][0]["notificationId"]

    status, _ = call(
        notification_handler(),
        "PATCH",
        "/notifications/{id}/read",
        user="co_1",
        groups=RECRUITER,
        path={"id": target},
    )
    assert status == 200

    _, after = call(
        notification_handler(), "GET", "/notifications", user="co_1", groups=RECRUITER
    )
    assert after["unreadCount"] == before - 1


def test_marking_all_read_clears_the_count(posting):
    status, payload = call(
        notification_handler(), "PATCH", "/notifications/read-all", user="co_1", groups=RECRUITER
    )
    assert status == 200
    assert payload["unreadCount"] == 0


def test_a_user_sees_only_their_own_notifications(posting):
    _, payload = call(
        notification_handler(), "GET", "/notifications", user="app_9", groups=APPLICANT
    )
    assert payload["count"] == 0


# ----------------------------------------------------------------------
# Bulk actions and export
# ----------------------------------------------------------------------
def test_a_bulk_change_reports_each_outcome_separately(posting):
    first = submitted_application(posting)

    status, payload = call(
        jobs_handler(),
        "PATCH",
        "/jobs/{id}/applications/bulk-status",
        user="co_1",
        groups=RECRUITER,
        path={"id": posting},
        body={
            "status": "UNDER_REVIEW",
            "applicationIds": [first, "app_does_not_exist"],
            "note": "Screening pass.",
        },
    )
    assert status == 200
    assert payload["updated"] == [first]
    assert payload["refused"][0]["applicationId"] == "app_does_not_exist"


def test_a_bulk_change_refuses_a_transition_the_state_model_forbids(posting):
    application_id = submitted_application(posting)
    _, payload = call(
        jobs_handler(),
        "PATCH",
        "/jobs/{id}/applications/bulk-status",
        user="co_1",
        groups=RECRUITER,
        path={"id": posting},
        body={"status": "OFFER_ACCEPTED", "applicationIds": [application_id]},
    )
    assert payload["updated"] == []
    assert payload["refused"][0]["applicationId"] == application_id


def test_an_export_returns_a_presigned_url_and_counts_its_rows(posting):
    submitted_application(posting)

    status, payload = call(
        jobs_handler(),
        "POST",
        "/companies/{id}/export",
        user="co_1",
        groups=RECRUITER,
        path={"id": "co_1"},
        body={},
    )
    assert status == 201
    assert payload["rows"] == 1
    assert "X-Amz-Signature" in payload["downloadUrl"]


def test_an_export_is_scoped_to_the_account_that_owns_the_postings(posting):
    status, _ = call(
        jobs_handler(),
        "POST",
        "/companies/{id}/export",
        user="co_2",
        groups=RECRUITER,
        path={"id": "co_1"},
        body={},
    )
    assert status == 403


def test_account_analytics_aggregate_across_postings(posting):
    submitted_application(posting)
    status, payload = call(
        jobs_handler(),
        "GET",
        "/companies/{id}/analytics",
        user="co_1",
        groups=RECRUITER,
        path={"id": "co_1"},
    )
    assert status == 200
    assert payload["postings"] == 1
    assert payload["totalApplications"] == 1
    assert payload["byOpportunityType"]["FULL_TIME_JOB"] == 1


def test_the_pipeline_row_carries_the_next_interview_and_the_time_in_stage(posting):  # noqa: F811
    """The board needs both to draw a card, and neither is on the application
    list shape, so the pipeline row has to supply them."""
    application_id = submitted_application(posting)

    status, payload = call(
        jobs_handler(),
        "GET",
        "/jobs/{id}/applications",
        user="co_1",
        groups=RECRUITER,
        path={"id": posting},
    )
    assert status == 200
    row = payload["applications"][0]
    # Nothing has moved yet, so the stage began when the application arrived.
    # The submission history entry and appliedAt are written by separate calls,
    # so they land milliseconds apart rather than on the same instant.
    assert row["statusChangedAt"] >= row["appliedAt"]
    assert row["statusChangedAt"][:16] == row["appliedAt"][:16]
    assert row["nextInterview"] is None

    scheduled_status, _ = schedule(application_id, days=4.0)
    assert scheduled_status == 201

    _, after = call(
        jobs_handler(),
        "GET",
        "/jobs/{id}/applications",
        user="co_1",
        groups=RECRUITER,
        path={"id": posting},
    )
    moved = after["applications"][0]
    assert moved["status"] == "INTERVIEW_SCHEDULED"
    assert moved["nextInterview"]["state"] == "PROPOSED"
    assert moved["nextInterview"]["scheduledAt"]
    # Scheduling is a status change, so the stage clock restarts from it.
    assert moved["statusChangedAt"] > moved["appliedAt"]


def test_a_declined_interview_leaves_no_next_interview_on_the_row(posting):  # noqa: F811
    application_id = submitted_application(posting)
    assert schedule(application_id, days=4.0)[0] == 201

    declined, _ = call(
        app_handler(),
        "PATCH",
        "/applications/{id}/interview",
        user="app_1",
        groups=APPLICANT,
        path={"id": application_id},
        body={"action": "DECLINE"},
    )
    assert declined == 200

    _, payload = call(
        jobs_handler(),
        "GET",
        "/jobs/{id}/applications",
        user="co_1",
        groups=RECRUITER,
        path={"id": posting},
    )
    assert payload["applications"][0]["nextInterview"] is None
