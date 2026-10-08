"""The applicants directory, where the same person is one person.

Every other recruiter view is organised by posting, so somebody who applied to
three openings appears three times with nothing tying the rows together. These
tests are about the grouping and about the two questions the grouping makes
answerable: how far did this person actually get, and which side is holding
things up.

The pipeline card test at the end is here rather than with the board tests
because it pins the same two fields this directory derives.
"""
from conftest import call
from test_integration_applications import (
    ADMIN,
    APPLICANT,
    RECRUITER,
    app_handler,
    auth_handler,
    jobs_handler,
    posting,  # noqa: F401 - used as a fixture
    submit,
    submitted_application,
    upload_cv,
)


def name_applicant(user_id, full_name, skills=None):
    """Give an applicant a profile, which is where a name and skills live."""
    return call(
        auth_handler(),
        "POST",
        "/profile",
        user=user_id,
        groups=APPLICANT,
        body={"fullName": full_name, "skills": skills or []},
    )


def move(application_id, target, user="co_1", groups=RECRUITER):
    return call(
        app_handler(),
        "PATCH",
        "/applications/{id}/status",
        user=user,
        groups=groups,
        path={"id": application_id},
        body={"status": target},
    )


def second_posting(title="Data Analyst"):
    _, created = call(
        jobs_handler(),
        "POST",
        "/jobs",
        user="co_1",
        groups=RECRUITER,
        body={
            "title": title,
            "description": "Read the numbers.",
            "opportunityType": "FULL_TIME_JOB",
            "workModality": "REMOTE",
            "documentRequirements": [
                {"key": "cv", "label": "CV", "kind": "FILE", "required": True}
            ],
        },
    )
    job_id = created["job"]["jobId"]
    call(
        jobs_handler(),
        "PATCH",
        "/jobs/{id}",
        user="co_1",
        groups=RECRUITER,
        path={"id": job_id},
        body={"postingStatus": "PUBLISHED"},
    )
    return job_id


def apply_to(job_id, applicant="app_1"):
    _, upload = upload_cv(applicant=applicant, job_id=job_id)
    _, created = submit(job_id, applicant=applicant, cv_key=upload["s3Key"])
    return created["application"]["applicationId"]


def applicants(user="co_1", groups=RECRUITER, company="co_1"):
    return call(
        jobs_handler(),
        "GET",
        "/companies/{id}/applicants",
        user=user,
        groups=groups,
        path={"id": company},
    )


# ----------------------------------------------------------------------
# Grouping
# ----------------------------------------------------------------------
def test_one_person_applying_twice_is_one_row(posting):
    name_applicant("app_1", "Amara Nwosu", ["Python", "AWS"])
    submitted_application(posting)
    apply_to(second_posting())

    status, payload = applicants()
    assert status == 200
    assert len(payload["applicants"]) == 1

    row = payload["applicants"][0]
    assert row["applicantId"] == "app_1"
    assert row["fullName"] == "Amara Nwosu"
    assert row["skills"] == ["Python", "AWS"]
    assert row["applicationCount"] == 2
    assert {a["jobTitle"] for a in row["applications"]} == {
        "Backend Engineer",
        "Data Analyst",
    }


def test_two_people_are_two_rows(posting):
    name_applicant("app_1", "Amara Nwosu")
    name_applicant("app_2", "Diego Santos")
    submitted_application(posting)
    apply_to(posting, applicant="app_2")

    _, payload = applicants()
    assert {row["applicantId"] for row in payload["applicants"]} == {"app_1", "app_2"}
    assert all(row["applicationCount"] == 1 for row in payload["applicants"])


def test_an_account_with_no_applications_returns_an_empty_list(posting):
    status, payload = applicants()
    assert status == 200
    assert payload["applicants"] == []


# ----------------------------------------------------------------------
# How far they got
# ----------------------------------------------------------------------
def test_the_furthest_stage_is_reported_rather_than_the_latest(posting):
    """Rejected on one posting and under review on another is under review."""
    name_applicant("app_1", "Amara Nwosu")
    first = submitted_application(posting)
    second = apply_to(second_posting())

    move(first, "UNDER_REVIEW")
    move(first, "REJECTED")
    move(second, "UNDER_REVIEW")

    row = applicants()[1]["applicants"][0]
    assert row["furthestStatus"] == "UNDER_REVIEW"
    assert row["isActive"] is True


def test_somebody_turned_down_everywhere_is_not_active(posting):
    name_applicant("app_1", "Amara Nwosu")
    application_id = submitted_application(posting)
    move(application_id, "UNDER_REVIEW")
    move(application_id, "REJECTED")

    row = applicants()[1]["applicants"][0]
    assert row["furthestStatus"] == "REJECTED"
    assert row["isActive"] is False


def test_an_applicant_declining_is_reported_over_a_rejection(posting):
    """Both endings present, and the one they chose is the useful one."""
    name_applicant("app_1", "Amara Nwosu")
    first = submitted_application(posting)
    second = apply_to(second_posting())

    move(first, "UNDER_REVIEW")
    move(first, "REJECTED")
    move(second, "UNDER_REVIEW")
    move(second, "OFFER_EXTENDED")
    move(second, "OFFER_DECLINED", user="app_1", groups=APPLICANT)

    row = applicants()[1]["applicants"][0]
    assert row["furthestStatus"] == "OFFER_DECLINED"
    assert row["isActive"] is False


# ----------------------------------------------------------------------
# Which side is holding things up
# ----------------------------------------------------------------------
def test_an_unopened_application_is_waiting_on_the_company(posting):
    name_applicant("app_1", "Amara Nwosu")
    submitted_application(posting)

    row = applicants()[1]["applicants"][0]
    assert row["awaitingReview"] == 1
    assert row["awaitingTheirReply"] == 0


def test_an_offer_is_waiting_on_the_applicant(posting):
    name_applicant("app_1", "Amara Nwosu")
    application_id = submitted_application(posting)
    move(application_id, "UNDER_REVIEW")
    move(application_id, "OFFER_EXTENDED")

    row = applicants()[1]["applicants"][0]
    assert row["awaitingReview"] == 0
    assert row["awaitingTheirReply"] == 1


def test_opening_an_application_clears_it_from_the_review_count(posting):
    name_applicant("app_1", "Amara Nwosu")
    application_id = submitted_application(posting)
    assert applicants()[1]["applicants"][0]["awaitingReview"] == 1

    move(application_id, "UNDER_REVIEW")
    assert applicants()[1]["applicants"][0]["awaitingReview"] == 0


# ----------------------------------------------------------------------
# Who may read it
# ----------------------------------------------------------------------
def test_another_company_sees_none_of_this(posting):
    name_applicant("app_1", "Amara Nwosu")
    submitted_application(posting)
    status, _ = applicants(user="co_2")
    assert status == 403


def test_an_applicant_cannot_read_the_directory(posting):
    status, _ = applicants(user="app_1", groups=APPLICANT)
    assert status == 403


def test_an_admin_can_read_it(posting):
    name_applicant("app_1", "Amara Nwosu")
    submitted_application(posting)
    status, payload = applicants(user="admin_1", groups=ADMIN)
    assert status == 200
    assert len(payload["applicants"]) == 1


# ----------------------------------------------------------------------
# The board card
# ----------------------------------------------------------------------
def test_a_board_card_carries_what_the_board_reads(posting):
    """The two fields the recruiter card renders and the API used to omit.

    Without statusChangedAt the card counted time in stage from an invalid date
    and printed NaN; without nextInterview an application sitting at
    INTERVIEW_SCHEDULED showed no time on its card.
    """
    name_applicant("app_1", "Amara Nwosu")
    application_id = submitted_application(posting)
    move(application_id, "UNDER_REVIEW")

    _, payload = call(
        jobs_handler(),
        "GET",
        "/jobs/{id}/applications",
        user="co_1",
        groups=RECRUITER,
        path={"id": posting},
    )
    row = payload["applications"][0]
    assert row["applicationId"] == application_id
    assert row["statusChangedAt"], "the card counts time in stage from this"
    assert "nextInterview" in row
    assert row["applicantName"] == "Amara Nwosu"
