"""Submission, the duplicate guard, the edit window and the freeze point.

The conditional writes behind FR-5.3 and FR-6.10 cannot be tested without a real
DynamoDB, so this is the suite that actually covers them.
"""
import boto3
import pytest

from conftest import REGION, call, event

APPLICANT = ("Applicants",)
RECRUITER = ("Recruiters",)
ADMIN = ("Admins",)


def app_handler():
    from handlers.application_service.handler import lambda_handler

    return lambda_handler


def jobs_handler():
    from handlers.jobs_service.handler import lambda_handler

    return lambda_handler


def auth_handler():
    from handlers.auth_service.handler import lambda_handler

    return lambda_handler


def company_handler():
    from handlers.company_service.handler import lambda_handler

    return lambda_handler


@pytest.fixture
def posting(aws):
    """A verified company with one published posting asking for a CV only."""
    call(
        company_handler(),
        "POST",
        "/companies",
        user="co_1",
        groups=RECRUITER,
        body={
            "companyName": "Acme Engineering",
            "contactEmail": "co_1@example.com",
            "companyWebsiteUrl": "https://acme.example.com",
        },
    )
    call(
        company_handler(),
        "PATCH",
        "/companies/{id}/status",
        user="admin_1",
        groups=ADMIN,
        path={"id": "co_1"},
        body={"verificationStatus": "VERIFIED"},
    )
    _, created = call(
        jobs_handler(),
        "POST",
        "/jobs",
        user="co_1",
        groups=RECRUITER,
        body={
            "title": "Backend Engineer",
            "description": "Build the platform services.",
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


def upload_cv(applicant="app_1", job_id=None, file_name="cv.pdf"):
    status, payload = call(
        app_handler(),
        "POST",
        "/applications/upload-url",
        user=applicant,
        groups=APPLICANT,
        body={"jobId": job_id, "documentKey": "cv", "fileName": file_name},
    )
    return status, payload


def submit(job_id, applicant="app_1", cv_key=None, **extra):
    body = {"jobId": job_id, "documents": {"cv": cv_key}}
    body.update(extra)
    return call(
        app_handler(), "POST", "/applications", user=applicant, groups=APPLICANT, body=body
    )


# ----------------------------------------------------------------------
# Upload
# ----------------------------------------------------------------------
def test_an_upload_url_is_issued_for_a_document_the_posting_wants(posting):
    status, payload = upload_cv(job_id=posting)
    assert status == 201
    assert payload["s3Key"].startswith("cvs/app_1/")
    assert "X-Amz-Signature" in payload["uploadUrl"]
    assert payload["expiresInSeconds"] == 900


def test_no_upload_url_for_a_document_the_posting_never_asked_for(posting):
    status, payload = call(
        app_handler(),
        "POST",
        "/applications/upload-url",
        user="app_1",
        groups=APPLICANT,
        body={"jobId": posting, "documentKey": "transcript", "fileName": "t.pdf"},
    )
    assert status == 400
    assert payload["error"]["details"]["requirements"]


def test_an_unsupported_file_type_is_refused(posting):
    status, payload = call(
        app_handler(),
        "POST",
        "/applications/upload-url",
        user="app_1",
        groups=APPLICANT,
        body={"jobId": posting, "documentKey": "cv", "fileName": "cv.exe"},
    )
    assert status == 400
    fields = {item["field"] for item in payload["error"]["details"]["fields"]}
    assert "fileName" in fields


# ----------------------------------------------------------------------
# Submission
# ----------------------------------------------------------------------
def test_a_complete_submission_is_accepted_and_queued(posting, aws):
    _, upload = upload_cv(job_id=posting)
    status, payload = submit(posting, cv_key=upload["s3Key"])

    assert status == 202
    assert payload["application"]["status"] == "SUBMITTED"
    assert payload["application"]["canEdit"] is True

    messages = boto3.client("sqs", region_name="us-east-1").receive_message(
        QueueUrl=aws["queueUrl"], MaxNumberOfMessages=1
    )
    assert len(messages.get("Messages", [])) == 1


def test_a_submission_missing_a_required_document_is_refused(posting):
    status, payload = submit(posting, cv_key=None)
    assert status == 400
    assert payload["error"]["code"] == "REQUIRED_DOCUMENTS_MISSING"
    assert [item["key"] for item in payload["error"]["details"]["missing"]] == ["cv"]


def test_a_second_application_to_the_same_posting_is_refused(posting):
    _, upload = upload_cv(job_id=posting)
    submit(posting, cv_key=upload["s3Key"])

    status, payload = submit(posting, cv_key=upload["s3Key"])
    assert status == 409
    assert payload["error"]["code"] == "DUPLICATE_APPLICATION"


def test_a_document_belonging_to_somebody_else_is_refused(posting):
    _, upload = upload_cv(applicant="app_1", job_id=posting)
    status, _ = submit(posting, applicant="app_2", cv_key=upload["s3Key"])
    assert status == 403


def test_an_unpublished_posting_does_not_accept_applications(posting):
    call(
        jobs_handler(),
        "PATCH",
        "/jobs/{id}",
        user="co_1",
        groups=RECRUITER,
        path={"id": posting},
        body={"postingStatus": "CLOSED"},
    )
    _, upload = upload_cv(job_id=posting)
    status, payload = submit(posting, cv_key=upload["s3Key"])
    assert status == 409
    assert payload["error"]["code"] == "POSTING_NOT_OPEN"


def confirm_cv(s3_key, label=None, applicant="app_1"):
    """Stand in for the browser's direct PUT, then confirm it the way the client does."""
    boto3.client("s3", region_name=REGION).put_object(
        Bucket="test-documents", Key=s3_key, Body=b"%PDF-1.4 cv"
    )
    body = {"s3Key": s3_key}
    if label:
        body["label"] = label
    return call(
        auth_handler(), "POST", "/profile/cvs", user=applicant, groups=APPLICANT, body=body
    )


def test_a_cv_can_be_reused_from_an_earlier_upload(posting):
    _, issued = call(
        auth_handler(),
        "POST",
        "/profile/upload-url",
        user="app_1",
        groups=APPLICANT,
        body={"documentKind": "cv", "fileName": "electrical.pdf", "label": "Electrical"},
    )
    # Issuing the URL hands back the key and the label it would use, and nothing
    # is in the library yet.
    assert "cvId" not in issued["cv"]
    _, listed = call(auth_handler(), "GET", "/profile/cvs", user="app_1", groups=APPLICANT)
    assert listed["cvs"] == []

    status, confirmed = confirm_cv(issued["cv"]["s3Key"], label="Electrical")
    assert status == 201
    cv_id = confirmed["cv"]["cvId"]

    status, payload = call(
        app_handler(),
        "POST",
        "/applications",
        user="app_1",
        groups=APPLICANT,
        body={"jobId": posting, "reuseCvId": cv_id},
    )
    assert status == 202

    _, listed = call(auth_handler(), "GET", "/profile/cvs", user="app_1", groups=APPLICANT)
    assert listed["cvs"][0]["label"] == "Electrical"
    assert "downloadUrl" in listed["cvs"][0]


def test_an_abandoned_upload_leaves_nothing_in_the_cv_library(posting):
    """The whole point of confirming separately: the URL is only an offer."""
    _, issued = call(
        auth_handler(),
        "POST",
        "/profile/upload-url",
        user="app_1",
        groups=APPLICANT,
        body={"documentKind": "cv", "fileName": "never-sent.pdf"},
    )

    _, listed = call(auth_handler(), "GET", "/profile/cvs", user="app_1", groups=APPLICANT)
    assert listed["cvs"] == []
    assert listed["totalUploaded"] == 0

    # Claiming an upload that never happened is refused rather than recorded.
    status, payload = call(
        auth_handler(),
        "POST",
        "/profile/cvs",
        user="app_1",
        groups=APPLICANT,
        body={"s3Key": issued["cv"]["s3Key"]},
    )
    assert status == 400
    assert payload["error"]["code"] == "VALIDATION_FAILED"


def test_confirming_the_same_upload_twice_records_one_cv(posting):
    """A client retrying on a flaky connection must not double the library."""
    _, issued = call(
        auth_handler(),
        "POST",
        "/profile/upload-url",
        user="app_1",
        groups=APPLICANT,
        body={"documentKind": "cv", "fileName": "retry.pdf", "label": "Retry"},
    )
    _, first = confirm_cv(issued["cv"]["s3Key"], label="Retry")
    _, second = confirm_cv(issued["cv"]["s3Key"], label="Retry")

    assert first["cv"]["cvId"] == second["cv"]["cvId"]
    _, listed = call(auth_handler(), "GET", "/profile/cvs", user="app_1", groups=APPLICANT)
    assert listed["totalUploaded"] == 1


def test_a_cv_key_belonging_to_someone_else_is_refused(posting):
    _, issued = call(
        auth_handler(),
        "POST",
        "/profile/upload-url",
        user="app_1",
        groups=APPLICANT,
        body={"documentKind": "cv", "fileName": "theirs.pdf"},
    )
    boto3.client("s3", region_name=REGION).put_object(
        Bucket="test-documents", Key=issued["cv"]["s3Key"], Body=b"%PDF-1.4 cv"
    )
    status, payload = call(
        auth_handler(),
        "POST",
        "/profile/cvs",
        user="app_2",
        groups=APPLICANT,
        body={"s3Key": issued["cv"]["s3Key"]},
    )
    assert status == 403


# ----------------------------------------------------------------------
# The edit window and the freeze point
# ----------------------------------------------------------------------
def submitted_application(job_id):
    _, upload = upload_cv(job_id=job_id)
    _, payload = submit(job_id, cv_key=upload["s3Key"])
    return payload["application"]["applicationId"]


def test_an_application_can_be_amended_while_submitted(posting):
    application_id = submitted_application(posting)
    status, payload = call(
        app_handler(),
        "PATCH",
        "/applications/{id}",
        user="app_1",
        groups=APPLICANT,
        path={"id": application_id},
        body={"coverLetter": "A second thought."},
    )
    assert status == 200
    assert payload["application"]["lastEditedAt"]


def test_a_recruiter_opening_it_moves_it_to_under_review(posting):
    application_id = submitted_application(posting)
    status, payload = call(
        app_handler(),
        "GET",
        "/applications/{id}",
        user="co_1",
        groups=RECRUITER,
        path={"id": application_id},
    )
    assert status == 200
    assert payload["application"]["status"] == "UNDER_REVIEW"


def test_opening_it_twice_records_one_history_entry(posting):
    application_id = submitted_application(posting)
    for _ in range(2):
        call(
            app_handler(),
            "GET",
            "/applications/{id}",
            user="co_1",
            groups=RECRUITER,
            path={"id": application_id},
        )
    _, payload = call(
        app_handler(),
        "GET",
        "/applications/{id}",
        user="co_1",
        groups=RECRUITER,
        path={"id": application_id},
    )
    opened = [
        entry
        for entry in payload["application"]["statusHistory"]
        if entry["status"] == "UNDER_REVIEW"
    ]
    assert len(opened) == 1


def test_it_can_no_longer_be_edited_once_under_review(posting):
    application_id = submitted_application(posting)
    call(
        app_handler(),
        "GET",
        "/applications/{id}",
        user="co_1",
        groups=RECRUITER,
        path={"id": application_id},
    )
    status, payload = call(
        app_handler(),
        "PATCH",
        "/applications/{id}",
        user="app_1",
        groups=APPLICANT,
        path={"id": application_id},
        body={"coverLetter": "Too late."},
    )
    assert status == 409
    assert payload["error"]["code"] == "APPLICATION_FROZEN"


def test_the_applicant_view_says_whether_editing_is_still_open(posting):
    application_id = submitted_application(posting)
    _, before = call(
        app_handler(), "GET", "/applications/me", user="app_1", groups=APPLICANT
    )
    assert before["applications"][0]["canEdit"] is True

    call(
        app_handler(),
        "GET",
        "/applications/{id}",
        user="co_1",
        groups=RECRUITER,
        path={"id": application_id},
    )
    _, after = call(
        app_handler(), "GET", "/applications/me", user="app_1", groups=APPLICANT
    )
    assert after["applications"][0]["canEdit"] is False


# ----------------------------------------------------------------------
# Ownership and status
# ----------------------------------------------------------------------
def test_another_company_cannot_read_the_application(posting):
    application_id = submitted_application(posting)
    status, _ = call(
        app_handler(),
        "GET",
        "/applications/{id}",
        user="co_2",
        groups=RECRUITER,
        path={"id": application_id},
    )
    assert status == 403


def test_an_applicant_cannot_read_somebody_else_application(posting):
    application_id = submitted_application(posting)
    status, _ = call(
        app_handler(),
        "GET",
        "/applications/{id}",
        user="app_2",
        groups=APPLICANT,
        path={"id": application_id},
    )
    assert status == 403


def test_a_forbidden_transition_names_what_is_reachable(posting):
    application_id = submitted_application(posting)
    status, payload = call(
        app_handler(),
        "PATCH",
        "/applications/{id}/status",
        user="co_1",
        groups=RECRUITER,
        path={"id": application_id},
        body={"status": "OFFER_EXTENDED"},
    )
    assert status == 409
    assert payload["error"]["details"]["currentStatus"] == "SUBMITTED"
    assert "UNDER_REVIEW" in payload["error"]["details"]["allowedNext"]


def test_only_the_applicant_can_accept_an_offer(posting):
    application_id = submitted_application(posting)
    for target in ("UNDER_REVIEW", "OFFER_EXTENDED"):
        call(
            app_handler(),
            "PATCH",
            "/applications/{id}/status",
            user="co_1",
            groups=RECRUITER,
            path={"id": application_id},
            body={"status": target},
        )

    refused, _ = call(
        app_handler(),
        "PATCH",
        "/applications/{id}/status",
        user="co_1",
        groups=RECRUITER,
        path={"id": application_id},
        body={"status": "OFFER_ACCEPTED"},
    )
    assert refused == 409

    accepted, payload = call(
        app_handler(),
        "PATCH",
        "/applications/{id}/status",
        user="app_1",
        groups=APPLICANT,
        path={"id": application_id},
        body={"status": "OFFER_ACCEPTED"},
    )
    assert accepted == 200
    assert payload["application"]["isFinal"] is True


def test_the_pipeline_lists_applications_for_the_owning_company_only(posting):
    submitted_application(posting)

    status, payload = call(
        jobs_handler(),
        "GET",
        "/jobs/{id}/applications",
        user="co_1",
        groups=RECRUITER,
        path={"id": posting},
    )
    assert status == 200
    assert payload["count"] == 1

    refused, _ = call(
        jobs_handler(),
        "GET",
        "/jobs/{id}/applications",
        user="co_2",
        groups=RECRUITER,
        path={"id": posting},
    )
    assert refused == 403


def test_the_funnel_counts_come_out_of_the_status_history(posting):
    application_id = submitted_application(posting)
    call(
        app_handler(),
        "PATCH",
        "/applications/{id}/status",
        user="co_1",
        groups=RECRUITER,
        path={"id": application_id},
        body={"status": "UNDER_REVIEW"},
    )

    status, payload = call(
        jobs_handler(),
        "GET",
        "/jobs/{id}/analytics",
        user="co_1",
        groups=RECRUITER,
        path={"id": posting},
    )
    assert status == 200
    assert payload["totalApplications"] == 1
    assert payload["funnel"]["UNDER_REVIEW"] == 1
    assert payload["funnel"]["SUBMITTED"] == 0
