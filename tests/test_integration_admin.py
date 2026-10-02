"""Admin onboarding of a company, and the overview.

This is the only code in the system that creates a Cognito account, so it is
worth running against a real pool rather than trusting it to be right.
"""
import boto3
import pytest

from conftest import call

ADMIN = ("Admins",)
RECRUITER = ("Recruiters",)
APPLICANT = ("Applicants",)


def company_handler():
    from handlers.company_service.handler import lambda_handler

    return lambda_handler


@pytest.fixture
def user_pool(aws, monkeypatch):
    """A pool carrying the custom attributes the sign up form writes."""
    idp = boto3.client("cognito-idp", region_name="us-east-1")
    pool_id = idp.create_user_pool(
        PoolName="test-pool",
        Schema=[
            {"Name": "accountType", "AttributeDataType": "String", "Mutable": False},
            {"Name": "companyName", "AttributeDataType": "String", "Mutable": True},
        ],
    )["UserPool"]["Id"]
    for group in ("Applicants", "Recruiters", "Admins"):
        idp.create_group(GroupName=group, UserPoolId=pool_id)

    from common import config

    monkeypatch.setattr(config, "USER_POOL_ID", pool_id)
    return pool_id


def create(email_address="beta@example.com", **extra):
    body = {
        "companyName": "Beta Laboratories",
        "contactEmail": email_address,
        "companyWebsiteUrl": "https://beta.example.com",
    }
    body.update(extra)
    return call(
        company_handler(),
        "POST",
        "/admin/companies",
        user="admin_1",
        groups=ADMIN,
        body=body,
    )


def test_an_admin_creates_the_account_and_the_company_together(user_pool):
    status, payload = create()
    assert status == 201
    assert payload["accountCreated"] is True
    assert payload["company"]["verificationStatus"] == "VERIFIED"
    assert payload["company"]["createdByAdmin"] == "admin_1"


def test_the_new_account_lands_in_the_recruiter_group(user_pool):
    _, payload = create()
    idp = boto3.client("cognito-idp", region_name="us-east-1")
    groups = idp.admin_list_groups_for_user(
        UserPoolId=user_pool, Username="beta@example.com"
    )["Groups"]
    assert [group["GroupName"] for group in groups] == ["Recruiters"]


def test_the_creation_is_the_first_entry_in_the_moderation_history(user_pool):
    _, payload = create()
    history = payload["company"]["moderationHistory"]
    assert history[0]["from"] == "NONE"
    assert history[0]["by"] == "admin_1"


def test_an_admin_can_send_it_through_the_queue_instead(user_pool):
    _, payload = create(email_address="gamma@example.com", verifyNow=False)
    assert payload["company"]["verificationStatus"] == "PENDING_VERIFICATION"


def test_a_duplicate_email_address_is_refused(user_pool):
    create()
    status, payload = create()
    assert status == 409
    assert "already exists" in payload["error"]["message"]


def test_only_an_admin_may_create_a_company_this_way(user_pool):
    for groups in (RECRUITER, APPLICANT):
        status, _ = call(
            company_handler(),
            "POST",
            "/admin/companies",
            user="someone",
            groups=groups,
            body={
                "companyName": "Sneaky",
                "contactEmail": "sneaky@example.com",
                "companyWebsiteUrl": "https://sneaky.example.com",
            },
        )
        assert status == 403


def test_the_overview_reports_the_queue_exactly(user_pool):
    create(email_address="one@example.com", verifyNow=False)
    create(email_address="two@example.com", verifyNow=True)

    status, payload = call(
        company_handler(), "GET", "/admin/overview", user="admin_1", groups=ADMIN
    )
    assert status == 200
    assert payload["awaitingVerification"] == 1
    assert payload["countsAreApproximate"] is True
    assert set(payload["approximateCounts"]) == {
        "users",
        "companies",
        "postings",
        "applications",
    }


def test_the_overview_is_closed_to_everybody_else(user_pool):
    status, _ = call(
        company_handler(), "GET", "/admin/overview", user="co_1", groups=RECRUITER
    )
    assert status == 403
