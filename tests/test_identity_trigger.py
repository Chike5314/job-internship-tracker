"""Tests for the group the identity trigger decides on.

FR-1.2 and FR-1.3. Only the group decision is tested here, since everything else
in that handler is a Cognito call.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from handlers.identity_service.handler import (  # noqa: E402
    APPLICANTS,
    RECRUITERS,
    _intended_group,
)


def test_a_company_sign_up_goes_to_recruiters():
    for marker in ("company", "recruiter", "employer", "Company", " COMPANY "):
        assert _intended_group({"custom:accountType": marker}) == RECRUITERS


def test_an_individual_sign_up_goes_to_applicants():
    assert _intended_group({"custom:accountType": "individual"}) == APPLICANTS


def test_a_missing_marker_defaults_to_applicants():
    """A Google sign in carries no accountType, and an applicant is the safe default."""
    assert _intended_group({}) == APPLICANTS


def test_an_unrecognised_marker_never_becomes_an_admin():
    for attempt in ("admin", "Admins", "ADMIN", "superuser"):
        assert _intended_group({"custom:accountType": attempt}) == APPLICANTS
