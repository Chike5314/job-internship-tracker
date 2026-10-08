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
    submit,
    submitted_application,
    upload_cv,
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


def _bulk(posting, status, ids, note=None):
    body = {"status": status, "applicationIds": ids}
    if note:
        body["note"] = note
    return call(
        jobs_handler(),
        "PATCH",
        "/jobs/{id}/applications/bulk-status",
        user="co_1",
        groups=RECRUITER,
        path={"id": posting},
        body=body,
    )


def test_a_bulk_change_never_moves_anyone_to_interview(posting):
    application_id = submitted_application(posting)
    _bulk(posting, "UNDER_REVIEW", [application_id])

    _, payload = _bulk(posting, "INTERVIEW_SCHEDULED", [application_id])
    assert payload["updated"] == []
    assert "one at a time" in payload["refused"][0]["reason"]

    _, detail = call(
        app_handler(), "GET", "/applications/{id}", user="co_1", groups=RECRUITER,
        path={"id": application_id},
    )
    assert detail["application"]["status"] == "UNDER_REVIEW"


def test_a_bulk_offer_promotes_everyone_under_review(posting):
    ids = []
    for n in range(3):
        _, upload = upload_cv(applicant=f"app_{n}", job_id=posting)
        _, created = submit(posting, applicant=f"app_{n}", cv_key=upload["s3Key"])
        ids.append(created["application"]["applicationId"])
    _bulk(posting, "UNDER_REVIEW", ids)

    _, payload = _bulk(posting, "OFFER_EXTENDED", ids, note="Welcome aboard.")
    assert sorted(payload["updated"]) == sorted(ids)
    assert payload["refused"] == []


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


# ----------------------------------------------------------------------
# Reinstating a rejection
# ----------------------------------------------------------------------
def reinstate(application_id, company="co_1", groups=RECRUITER, body=None):
    return call(
        app_handler(),
        "POST",
        "/applications/{id}/reinstate",
        user=company,
        groups=groups,
        path={"id": application_id},
        body=body or {},
    )


def reject(application_id, company="co_1"):
    return call(
        app_handler(),
        "PATCH",
        "/applications/{id}/status",
        user=company,
        groups=RECRUITER,
        path={"id": application_id},
        body={"status": "REJECTED"},
    )


def test_reinstating_restores_the_status_held_before_the_rejection(posting):
    """An application rejected out of an interview goes back to its interview,
    not to the bottom of the funnel."""
    application_id = submitted_application(posting)
    schedule(application_id, days=3)
    reject(application_id)

    status, payload = reinstate(application_id)
    assert status == 200
    assert payload["application"]["status"] == "INTERVIEW_SCHEDULED"


def test_reinstating_puts_a_future_interview_back_on_the_calendar(posting):
    """The rejection took the row off the sparse index. Reinstating has to put
    it back, which only happens if the route runs interviews.apply again."""
    application_id = submitted_application(posting)
    schedule(application_id, days=3)
    reject(application_id)
    assert calendar()[1]["count"] == 0

    reinstate(application_id)
    _, payload = calendar()
    assert payload["count"] == 1
    assert payload["interviews"][0]["applicationId"] == application_id


def test_the_rejection_stays_in_the_history(posting):
    """Nothing is overwritten: the mistake and its correction both read."""
    application_id = submitted_application(posting)
    reject(application_id)
    _, payload = reinstate(application_id)

    statuses = [entry["status"] for entry in payload["application"]["statusHistory"]]
    assert "REJECTED" in statuses
    assert statuses[-1] == "UNDER_REVIEW"


def test_only_a_rejected_application_can_be_reinstated(posting):
    application_id = submitted_application(posting)
    status, _ = reinstate(application_id)
    assert status == 409


def test_another_company_cannot_reinstate(posting):
    application_id = submitted_application(posting)
    reject(application_id)
    status, _ = reinstate(application_id, company="co_2")
    assert status == 403


def test_reinstating_twice_leaves_one_correction(posting):
    """The conditional write is what stops two recruiters both undoing it."""
    application_id = submitted_application(posting)
    reject(application_id)
    assert reinstate(application_id)[0] == 200

    second, _ = reinstate(application_id)
    assert second == 409


# ----------------------------------------------------------------------
# An interview that has happened
# ----------------------------------------------------------------------
def let_the_interview_pass(application_id, days_ago=3.0):
    """What the clock does, done to one row.

    An application carries nextInterviewAt until something writes to it, and
    time passing writes nothing, so this is the real state of any interview
    nobody recorded an outcome for.
    """
    from common import dynamo

    dynamo.applications().update_item(
        Key={"applicationId": application_id},
        UpdateExpression="SET nextInterviewAt = :past, nextInterview.scheduledAt = :past",
        ExpressionAttributeValues={":past": in_days(-days_ago)},
    )


def test_an_interview_still_ahead_is_on_the_calendar(posting):
    application_id = submitted_application(posting)
    schedule(application_id, days=5)

    _, payload = calendar()
    assert payload["count"] == 1
    assert payload["awaitingOutcome"] == []


def test_an_interview_that_has_passed_moves_to_awaiting_an_outcome(posting):
    """The whole point. It used to vanish from every screen while the account
    went on counting the application at INTERVIEW_SCHEDULED."""
    application_id = submitted_application(posting)
    schedule(application_id, days=5)
    let_the_interview_pass(application_id)

    _, payload = calendar()
    assert payload["count"] == 0, "it is not something coming up any more"
    assert len(payload["awaitingOutcome"]) == 1
    assert payload["awaitingOutcome"][0]["applicationId"] == application_id
    assert payload["awaitingOutcome"][0]["applicationStatus"] == "INTERVIEW_SCHEDULED"


def test_an_old_interview_is_not_lost_to_the_window(posting):
    """Four months is still waiting on somebody. A fortnight of lookback would
    have dropped it and put the account back where it started."""
    application_id = submitted_application(posting)
    schedule(application_id, days=5)
    let_the_interview_pass(application_id, days_ago=120)

    _, payload = calendar()
    assert len(payload["awaitingOutcome"]) == 1


def test_the_two_views_agree_once_an_outcome_is_recorded(posting):
    """Deciding is what clears it, which is the only thing that should."""
    application_id = submitted_application(posting)
    schedule(application_id, days=5)
    let_the_interview_pass(application_id)
    reject(application_id)

    _, payload = calendar()
    assert payload["interviews"] == []
    assert payload["awaitingOutcome"] == []

    _, analytics = call(
        jobs_handler(),
        "GET",
        "/companies/{id}/analytics",
        user="co_1",
        groups=RECRUITER,
        path={"id": "co_1"},
    )
    assert analytics["funnel"]["INTERVIEW_SCHEDULED"] == 0


def test_the_dashboard_count_and_the_calendar_now_agree(posting):
    """What the recruiter actually noticed: one at INTERVIEW_SCHEDULED in the
    funnel and nothing on any interview screen to explain it."""
    application_id = submitted_application(posting)
    schedule(application_id, days=5)
    let_the_interview_pass(application_id)

    _, analytics = call(
        jobs_handler(),
        "GET",
        "/companies/{id}/analytics",
        user="co_1",
        groups=RECRUITER,
        path={"id": "co_1"},
    )
    _, payload = calendar()
    counted = analytics["funnel"]["INTERVIEW_SCHEDULED"]
    shown = payload["count"] + len(payload["awaitingOutcome"])
    assert counted == 1
    assert shown == counted, "every application the funnel counts has a row somewhere"


def test_an_explicit_window_still_bounds_both_ends(posting):
    """A from of today means today onwards, for a day or week view."""
    application_id = submitted_application(posting)
    schedule(application_id, days=5)
    let_the_interview_pass(application_id)

    _, payload = calendar(query={"from": in_days(-1), "to": in_days(14)})
    assert payload["interviews"] == []
    assert payload["awaitingOutcome"] == []
