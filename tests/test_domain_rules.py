"""Tests for the rules that do not need AWS.

These cover the three places where a mistake would be quiet rather than loud:
the state model, the posting driven document rules, and the payload validation
that stands between a request and a write.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from common import documents, state_machine  # noqa: E402
from common.errors import (  # noqa: E402
    InvalidTransitionError,
    MissingDocumentsError,
    ValidationError,
)
from common.validation import Errors, require_https_url, validate_salary  # noqa: E402


# ----------------------------------------------------------------------
# State model, FR-6.4 to FR-6.6
# ----------------------------------------------------------------------
def test_recruiter_can_open_a_submitted_application():
    state_machine.assert_transition("SUBMITTED", "UNDER_REVIEW", "RECRUITER")


def test_recruiter_cannot_accept_an_offer_on_the_applicant_behalf():
    with pytest.raises(InvalidTransitionError):
        state_machine.assert_transition("OFFER_EXTENDED", "OFFER_ACCEPTED", "RECRUITER")


def test_applicant_accepts_only_from_offer_extended():
    state_machine.assert_transition("OFFER_EXTENDED", "OFFER_ACCEPTED", "APPLICANT")
    with pytest.raises(InvalidTransitionError):
        state_machine.assert_transition("UNDER_REVIEW", "OFFER_ACCEPTED", "APPLICANT")


def test_a_final_status_never_changes_again():
    for final in ("OFFER_ACCEPTED", "OFFER_DECLINED", "REJECTED", "WITHDRAWN"):
        with pytest.raises(InvalidTransitionError):
            state_machine.assert_transition(final, "UNDER_REVIEW", "RECRUITER")


def test_refusal_names_what_is_reachable_instead():
    with pytest.raises(InvalidTransitionError) as caught:
        state_machine.assert_transition("SUBMITTED", "OFFER_EXTENDED", "RECRUITER")
    assert caught.value.details["currentStatus"] == "SUBMITTED"
    assert "UNDER_REVIEW" in caught.value.details["allowedNext"]


def test_applicant_may_withdraw_before_a_final_status():
    for status in ("SUBMITTED", "UNDER_REVIEW", "INTERVIEW_SCHEDULED", "OFFER_EXTENDED"):
        state_machine.assert_transition(status, "WITHDRAWN", "APPLICANT")


# ----------------------------------------------------------------------
# Document requirements, FR-4.15, FR-5.1 and FR-5.2
# ----------------------------------------------------------------------
def test_defaults_differ_by_opportunity_type():
    academic = {r["key"] for r in documents.default_requirements("ACADEMIC_INTERNSHIP")}
    job = {r["key"] for r in documents.default_requirements("FULL_TIME_JOB")}
    assert documents.SCHOOL_AUTHORISATION in academic
    assert documents.SCHOOL_AUTHORISATION not in job


def test_a_posting_that_drops_the_authorisation_letter_accepts_the_application():
    """The posting decides, not the opportunity type."""
    errors = Errors()
    requirements = documents.normalise_requirements(
        errors,
        [{"key": "cv", "label": "CV", "required": True, "kind": "FILE"}],
        "ACADEMIC_INTERNSHIP",
    )
    errors.raise_if_any()
    documents.validate_submission(requirements, {"cv": "cvs/u1/abc.pdf"}, {})


def test_a_missing_required_item_reports_the_whole_requirement_list():
    requirements = documents.default_requirements("FULL_TIME_JOB")
    with pytest.raises(MissingDocumentsError) as caught:
        documents.validate_submission(requirements, {"cv": "cvs/u1/abc.pdf"}, {})
    missing = {item["key"] for item in caught.value.details["missing"]}
    assert missing == {documents.COVER_LETTER}
    assert caught.value.details["requirements"] == requirements


def test_a_cv_is_always_asked_for():
    """FR-5.10, even when the recruiter leaves it out of their own list."""
    errors = Errors()
    requirements = documents.normalise_requirements(
        errors, [{"key": "portfolio", "label": "Portfolio", "kind": "TEXT"}], "FULL_TIME_JOB"
    )
    assert any(r["key"] == documents.CV for r in requirements)


def test_optional_items_do_not_block_a_submission():
    requirements = [
        {"key": "cv", "label": "CV", "kind": "FILE", "required": True},
        {"key": "portfolio", "label": "Portfolio", "kind": "TEXT", "required": False},
    ]
    documents.validate_submission(requirements, {"cv": "cvs/u1/a.pdf"}, {})


def test_anything_the_posting_did_not_ask_for_is_dropped():
    requirements = [{"key": "cv", "label": "CV", "kind": "FILE", "required": True}]
    kept = documents.strip_unknown(
        requirements, {"cv": "cvs/u1/a.pdf", "transcript": "transcripts/u1/b.pdf"}, "FILE"
    )
    assert kept == {"cv": "cvs/u1/a.pdf"}


# ----------------------------------------------------------------------
# Validation, FR-3.6, FR-4.13 and FR-11.2
# ----------------------------------------------------------------------
def test_company_website_must_be_https():
    errors = Errors()
    require_https_url(errors, {"companyWebsiteUrl": "http://example.com"}, "companyWebsiteUrl")
    with pytest.raises(ValidationError):
        errors.raise_if_any()


def test_every_failing_field_is_named_at_once():
    errors = Errors()
    errors.add("title", "This field is required.")
    errors.add("description", "This field is required.")
    with pytest.raises(ValidationError) as caught:
        errors.raise_if_any()
    named = {item["field"] for item in caught.value.details["fields"]}
    assert named == {"title", "description"}


def test_a_salary_range_cannot_be_inverted():
    errors = Errors()
    validate_salary(
        errors,
        {"salary": {"min": 900, "max": 400, "currency": "XAF", "period": "MONTH"}},
    )
    with pytest.raises(ValidationError):
        errors.raise_if_any()


def test_an_undisclosed_salary_is_accepted_without_figures():
    errors = Errors()
    result = validate_salary(errors, {"salary": {"disclosed": False}})
    errors.raise_if_any()
    assert result == {"disclosed": False}
