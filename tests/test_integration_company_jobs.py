"""Company registration, the verification gate and posting management.

These run the handlers against moto, so the index definitions, the conditional
writes and the ownership checks are all genuinely exercised.
"""
import boto3
import pytest

from conftest import REGION, call

APPLICANT = ("Applicants",)
RECRUITER = ("Recruiters",)
ADMIN = ("Admins",)


def company_handler():
    from handlers.company_service.handler import lambda_handler

    return lambda_handler


def jobs_handler():
    from handlers.jobs_service.handler import lambda_handler

    return lambda_handler


def register(company_id="co_1", name="Acme Engineering"):
    return call(
        company_handler(),
        "POST",
        "/companies",
        user=company_id,
        groups=RECRUITER,
        body={
            "companyName": name,
            "contactEmail": f"{company_id}@example.com",
            "companyWebsiteUrl": "https://acme.example.com",
            "officeAddress": "12 Rue Principale, Douala",
        },
    )


def verify(company_id="co_1", status="VERIFIED"):
    return call(
        company_handler(),
        "PATCH",
        "/companies/{id}/status",
        user="admin_1",
        groups=ADMIN,
        path={"id": company_id},
        body={"verificationStatus": status, "note": "Checked the website."},
    )


def create_posting(company_id="co_1", **overrides):
    body = {
        "title": "Backend Engineer",
        "description": "Build and run the platform services.",
        "opportunityType": "FULL_TIME_JOB",
        "workModality": "ONSITE",
        "city": "Douala",
        "experienceLevel": "ENTRY",
    }
    body.update(overrides)
    return call(
        jobs_handler(),
        "POST",
        "/jobs",
        user=company_id,
        groups=RECRUITER,
        body=body,
    )


# ----------------------------------------------------------------------
# Registration and verification
# ----------------------------------------------------------------------
def test_registration_lands_in_pending(aws):
    status, payload = register()
    assert status == 201
    assert payload["company"]["verificationStatus"] == "PENDING_VERIFICATION"


def test_registering_twice_is_refused(aws):
    register()
    status, payload = register()
    assert status == 409
    assert payload["error"]["code"] == "CONFLICT"


def test_website_must_be_https(aws):
    status, payload = call(
        company_handler(),
        "POST",
        "/companies",
        user="co_1",
        groups=RECRUITER,
        body={
            "companyName": "Acme",
            "contactEmail": "co@example.com",
            "companyWebsiteUrl": "http://acme.example.com",
        },
    )
    assert status == 400
    fields = {item["field"] for item in payload["error"]["details"]["fields"]}
    assert "companyWebsiteUrl" in fields


def test_the_pending_queue_is_served_by_the_index(aws):
    register("co_1")
    register("co_2", "Beta Labs")
    verify("co_2")

    status, payload = call(
        company_handler(),
        "GET",
        "/companies",
        user="admin_1",
        groups=ADMIN,
        query={"status": "PENDING_VERIFICATION"},
    )
    assert status == 200
    assert [c["companyId"] for c in payload["companies"]] == ["co_1"]


def test_an_applicant_cannot_moderate(aws):
    register()
    status, _ = call(
        company_handler(),
        "PATCH",
        "/companies/{id}/status",
        user="app_1",
        groups=APPLICANT,
        path={"id": "co_1"},
        body={"verificationStatus": "VERIFIED"},
    )
    assert status == 403


def test_a_decision_appends_to_the_history(aws):
    register()
    verify()
    _, payload = verify(status="SUSPENDED")
    history = payload["company"]["moderationHistory"]
    assert [entry["to"] for entry in history] == ["VERIFIED", "SUSPENDED"]
    assert history[0]["note"] == "Checked the website."


# ----------------------------------------------------------------------
# The publishing gate
# ----------------------------------------------------------------------
def test_an_unverified_company_cannot_publish(aws):
    register()
    _, created = create_posting()
    job_id = created["job"]["jobId"]

    status, payload = call(
        jobs_handler(),
        "PATCH",
        "/jobs/{id}",
        user="co_1",
        groups=RECRUITER,
        path={"id": job_id},
        body={"postingStatus": "PUBLISHED"},
    )
    assert status == 403
    assert "verified" in payload["error"]["message"]


def test_a_verified_company_can_publish(aws):
    register()
    verify()
    _, created = create_posting()
    status, payload = call(
        jobs_handler(),
        "PATCH",
        "/jobs/{id}",
        user="co_1",
        groups=RECRUITER,
        path={"id": created["job"]["jobId"]},
        body={"postingStatus": "PUBLISHED"},
    )
    assert status == 200
    assert payload["job"]["postingStatus"] == "PUBLISHED"


def test_one_company_cannot_edit_another_posting(aws):
    register("co_1")
    register("co_2", "Beta Labs")
    _, created = create_posting("co_1")

    status, _ = call(
        jobs_handler(),
        "PATCH",
        "/jobs/{id}",
        user="co_2",
        groups=RECRUITER,
        path={"id": created["job"]["jobId"]},
        body={"title": "Hijacked"},
    )
    assert status == 403


def test_a_start_date_set_after_creation_is_kept(aws):
    """The editor saves a start date on a posting that already exists, and the
    update route used to read every optional field except this one."""
    register()
    _, created = create_posting()
    job_id = created["job"]["jobId"]

    status, payload = call(
        jobs_handler(),
        "PATCH",
        "/jobs/{id}",
        user="co_1",
        groups=RECRUITER,
        path={"id": job_id},
        body={"startDate": "2027-01-04T08:00:00.000Z"},
    )
    assert status == 200
    assert payload["job"]["startDate"] == "2027-01-04T08:00:00.000Z"

    _, mine = call(
        jobs_handler(),
        "GET",
        "/jobs/mine/{id}",
        user="co_1",
        groups=RECRUITER,
        path={"id": job_id},
    )
    assert mine["job"]["startDate"] == "2027-01-04T08:00:00.000Z"


def test_a_start_date_that_is_not_a_date_is_refused_on_update(aws):
    register()
    _, created = create_posting()

    status, _ = call(
        jobs_handler(),
        "PATCH",
        "/jobs/{id}",
        user="co_1",
        groups=RECRUITER,
        path={"id": created["job"]["jobId"]},
        body={"startDate": "next spring"},
    )
    assert status == 400


def test_suspension_unpublishes_the_active_postings(aws):
    register()
    verify()
    _, created = create_posting()
    call(
        jobs_handler(),
        "PATCH",
        "/jobs/{id}",
        user="co_1",
        groups=RECRUITER,
        path={"id": created["job"]["jobId"]},
        body={"postingStatus": "PUBLISHED"},
    )

    status, payload = verify(status="SUSPENDED")
    assert status == 200
    assert payload["postingsUnpublished"] == 1

    # Through the owner's own route. The public GET /jobs/{id} carries no
    # authorizer, so it cannot recognise an owner and will not serve a posting
    # that is no longer published, to anyone.
    _, detail = call(
        jobs_handler(),
        "GET",
        "/jobs/mine/{id}",
        user="co_1",
        groups=RECRUITER,
        path={"id": created["job"]["jobId"]},
    )
    assert detail["job"]["postingStatus"] == "CLOSED"


# ----------------------------------------------------------------------
# The public listing
# ----------------------------------------------------------------------
def published_posting(company_id="co_1", **overrides):
    _, created = create_posting(company_id, **overrides)
    job_id = created["job"]["jobId"]
    call(
        jobs_handler(),
        "PATCH",
        "/jobs/{id}",
        user=company_id,
        groups=RECRUITER,
        path={"id": job_id},
        body={"postingStatus": "PUBLISHED"},
    )
    return job_id


def test_the_listing_shows_only_published_postings(aws):
    register()
    verify()
    published_posting()
    create_posting(title="Still a draft")

    status, payload = call(jobs_handler(), "GET", "/jobs")
    assert status == 200
    assert [job["title"] for job in payload["jobs"]] == ["Backend Engineer"]


def test_the_listing_filters_combine(aws):
    register()
    verify()
    published_posting(title="Onsite role", workModality="ONSITE", city="Douala")
    published_posting(title="Remote role", workModality="REMOTE", city="Yaounde")

    _, payload = call(
        jobs_handler(), "GET", "/jobs", query={"modality": "REMOTE", "city": "Yaounde"}
    )
    assert [job["title"] for job in payload["jobs"]] == ["Remote role"]


def test_keyword_search_matches_the_title_and_the_company_name(aws):
    register()
    verify()
    published_posting(title="Data Analyst")
    published_posting(title="Backend Engineer")

    _, by_title = call(jobs_handler(), "GET", "/jobs", query={"q": "analyst"})
    assert [job["title"] for job in by_title["jobs"]] == ["Data Analyst"]

    _, by_company = call(jobs_handler(), "GET", "/jobs", query={"q": "acme"})
    assert len(by_company["jobs"]) == 2


def test_filtering_by_opportunity_type_uses_its_own_index(aws):
    register()
    verify()
    published_posting(title="Full time role", opportunityType="FULL_TIME_JOB")
    published_posting(
        title="Academic placement", opportunityType="ACADEMIC_INTERNSHIP"
    )

    _, payload = call(
        jobs_handler(), "GET", "/jobs", query={"type": "ACADEMIC_INTERNSHIP"}
    )
    assert [job["title"] for job in payload["jobs"]] == ["Academic placement"]


# ----------------------------------------------------------------------
# The recruiter's own postings
# ----------------------------------------------------------------------
def test_mine_lists_the_callers_own_postings_including_drafts(aws):
    register()
    verify()
    published_posting(title="Published role")
    create_posting(title="Still a draft")
    register(company_id="co_2", name="Other Co")
    verify(company_id="co_2")
    published_posting(company_id="co_2", title="Someone else's role")

    status, payload = call(jobs_handler(), "GET", "/jobs/mine", user="co_1", groups=RECRUITER)
    assert status == 200
    assert sorted(job["title"] for job in payload["jobs"]) == [
        "Published role",
        "Still a draft",
    ]


def test_mine_requires_a_signed_in_caller(aws):
    # GET /jobs carries no Cognito authorizer, since it has to work for an
    # anonymous applicant browsing postings, so /jobs/mine is a separate route
    # rather than a query flag on it. This is what an unauthenticated request
    # looks like: no claims in the request context at all.
    status, payload = call(jobs_handler(), "GET", "/jobs/mine")
    assert status == 401
    assert payload["error"]["code"] == "UNAUTHORIZED"


def test_mine_is_refused_to_an_applicant(aws):
    status, payload = call(jobs_handler(), "GET", "/jobs/mine", user="applicant_1", groups=APPLICANT)
    assert status == 403
    assert payload["error"]["code"] == "FORBIDDEN"


def test_a_deadline_in_the_past_is_refused_at_creation(aws):
    register()
    verify()
    status, payload = create_posting(applicationDeadline="2020-01-01")
    assert status == 400
    assert "past" in payload["error"]["message"]


def test_the_default_document_set_follows_the_opportunity_type(aws):
    register()
    verify()
    _, created = create_posting(opportunityType="ACADEMIC_INTERNSHIP")
    keys = {item["key"] for item in created["job"]["documentRequirements"]}
    assert "schoolAuthorisation" in keys
    assert "transcript" in keys


def test_a_recruiter_may_drop_a_default_requirement(aws):
    register()
    verify()
    _, created = create_posting(
        opportunityType="ACADEMIC_INTERNSHIP",
        documentRequirements=[
            {"key": "cv", "label": "CV", "kind": "FILE", "required": True}
        ],
    )
    keys = {item["key"] for item in created["job"]["documentRequirements"]}
    assert keys == {"cv"}


# ----------------------------------------------------------------------
# Public routes and their authorizer protected counterparts
#
# API Gateway populates requestContext.authorizer.claims only on a route that
# has an authorizer attached. A public route therefore cannot tell who is
# calling, whatever the client sends, so every case that depends on knowing the
# caller lives on a separate route. These tests pin that split down.
# ----------------------------------------------------------------------
def test_the_public_posting_route_refuses_anything_unpublished(aws):
    register()
    verify()
    _, created = create_posting()
    job_id = created["job"]["jobId"]

    # Still a draft. Refused for everyone, the owner included, because the route
    # has no way to recognise an owner.
    for user, groups in (("anon", ()), ("co_1", RECRUITER), ("admin_1", ADMIN)):
        status, _ = call(
            jobs_handler(), "GET", "/jobs/{id}", user=user, groups=groups, path={"id": job_id}
        )
        assert status == 403


def test_the_owner_route_serves_a_draft_in_full(aws):
    register()
    verify()
    _, created = create_posting()
    job_id = created["job"]["jobId"]

    status, payload = call(
        jobs_handler(),
        "GET",
        "/jobs/mine/{id}",
        user="co_1",
        groups=RECRUITER,
        path={"id": job_id},
    )
    assert status == 200
    assert payload["job"]["postingStatus"] == "DRAFT"

    status, _ = call(
        jobs_handler(),
        "GET",
        "/jobs/mine/{id}",
        user="admin_1",
        groups=ADMIN,
        path={"id": job_id},
    )
    assert status == 200


def test_another_recruiter_cannot_read_a_posting_through_the_owner_route(aws):
    register()
    verify()
    _, created = create_posting()

    register(company_id="co_2", name="Beta Works")
    status, _ = call(
        jobs_handler(),
        "GET",
        "/jobs/mine/{id}",
        user="co_2",
        groups=RECRUITER,
        path={"id": created["job"]["jobId"]},
    )
    assert status == 403


def test_a_company_reads_its_own_record_in_full_through_its_own_route(aws):
    register()
    verify()

    # The public route serves the public view to everyone, with no moderation
    # history on it.
    _, public = call(
        company_handler(), "GET", "/companies/{id}", user="anon", groups=(), path={"id": "co_1"}
    )
    assert "moderationHistory" not in public["company"]

    status, mine = call(
        company_handler(), "GET", "/companies/mine", user="co_1", groups=RECRUITER
    )
    assert status == 200
    assert mine["company"]["companyId"] == "co_1"
    assert "moderationHistory" in mine["company"]


# ----------------------------------------------------------------------
# The company logo
# ----------------------------------------------------------------------
def test_a_company_logo_is_recorded_only_after_the_upload_lands(aws):
    register()
    verify()

    _, issued = call(
        company_handler(),
        "POST",
        "/companies/logo-upload-url",
        user="co_1",
        groups=RECRUITER,
        body={"fileName": "kora.png", "contentType": "image/png", "fileSize": 24_000},
    )
    key = issued["s3Key"]
    assert key.startswith("company-logos/co_1/")

    # Issuing the URL records nothing on the company.
    _, before = call(company_handler(), "GET", "/companies/mine", user="co_1", groups=RECRUITER)
    assert "logoUrl" not in before["company"]

    boto3.client("s3", region_name=REGION).put_object(
        Bucket="test-documents", Key=key, Body=b"\x89PNG"
    )
    status, saved = call(
        company_handler(),
        "PATCH",
        "/companies/{id}",
        user="co_1",
        groups=RECRUITER,
        path={"id": "co_1"},
        body={"logoS3Key": key},
    )
    assert status == 200
    # The key never leaves the API as a key.
    assert "logoS3Key" not in saved["company"]
    assert saved["company"]["logoUrl"].startswith("https://")


def test_a_logo_key_belonging_to_another_company_is_refused(aws):
    register()
    register(company_id="co_2", name="Beta Works")

    _, issued = call(
        company_handler(),
        "POST",
        "/companies/logo-upload-url",
        user="co_1",
        groups=RECRUITER,
        body={"fileName": "kora.png", "contentType": "image/png", "fileSize": 24_000},
    )
    status, _ = call(
        company_handler(),
        "PATCH",
        "/companies/{id}",
        user="co_2",
        groups=RECRUITER,
        path={"id": "co_2"},
        body={"logoS3Key": issued["s3Key"]},
    )
    assert status == 403


def test_changing_only_the_logo_keeps_a_verified_company_verified(aws):
    register()
    verify()

    _, issued = call(
        company_handler(),
        "POST",
        "/companies/logo-upload-url",
        user="co_1",
        groups=RECRUITER,
        body={"fileName": "kora.png", "contentType": "image/png", "fileSize": 24_000},
    )
    boto3.client("s3", region_name=REGION).put_object(
        Bucket="test-documents", Key=issued["s3Key"], Body=b"\x89PNG"
    )
    _, saved = call(
        company_handler(),
        "PATCH",
        "/companies/{id}",
        user="co_1",
        groups=RECRUITER,
        path={"id": "co_1"},
        body={"logoS3Key": issued["s3Key"]},
    )
    # Only the name and the website are what an admin checked, so a logo is not
    # a reason to send the account back for review.
    assert saved["company"]["verificationStatus"] == "VERIFIED"
