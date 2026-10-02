"""Cognito triggers that put an account into its group.

FR-1.2. A self registering individual belongs in Applicants and a self
registering company belongs in Recruiters, and that membership has to be in the
token because FR-1.4 checks authorisation from the group claims and nothing else.

Two triggers are used rather than one, because neither covers the whole picture
on its own.

Post confirmation fires once, when somebody finishes signing up with an email and
a password. It does not fire at all for an account arriving through Google, since
a federated account is never confirmed in this pool.

Pre token generation fires every time a token is issued, federated accounts
included. It is the one that closes the Google gap. It also writes the group into
the token being issued right now, because group membership is read before this
trigger runs, so an account added to a group here would otherwise get a first
token with no group in it and a puzzling refusal on its first call.

Admin is never assigned here. FR-1.3 keeps it to accounts created by hand.
"""
import functools
import logging
import os
from typing import Any, Dict, List

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

APPLICANTS = "Applicants"
RECRUITERS = "Recruiters"
ADMINS = "Admins"

# The value the sign up form writes to custom:accountType.
COMPANY_MARKERS = {"company", "recruiter", "employer"}


@functools.lru_cache(maxsize=1)
def _idp():
    return boto3.client("cognito-idp")


def _intended_group(attributes: Dict[str, Any]) -> str:
    """An account says at sign up which kind it is, and nothing else decides.

    Anything unrecognised is treated as an applicant, which is the safe default:
    the applicant group can neither publish a posting nor moderate anything.
    """
    declared = str(attributes.get("custom:accountType", "")).strip().lower()
    return RECRUITERS if declared in COMPANY_MARKERS else APPLICANTS


def _current_groups(user_pool_id: str, username: str) -> List[str]:
    try:
        response = _idp().admin_list_groups_for_user(
            UserPoolId=user_pool_id, Username=username, Limit=20
        )
        return [group["GroupName"] for group in response.get("Groups", [])]
    except Exception:  # noqa: BLE001
        logger.exception("could not read group membership")
        return []


def _add_to_group(user_pool_id: str, username: str, group: str) -> bool:
    try:
        _idp().admin_add_user_to_group(
            UserPoolId=user_pool_id, Username=username, GroupName=group
        )
        logger.info("added an account to %s", group)
        return True
    except Exception:  # noqa: BLE001
        logger.exception("could not add an account to %s", group)
        return False


def lambda_handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    source = event.get("triggerSource", "")
    user_pool_id = event.get("userPoolId") or os.environ.get("USER_POOL_ID", "")
    username = event.get("userName", "")
    attributes = (event.get("request") or {}).get("userAttributes") or {}

    if not user_pool_id or not username:
        return event

    if source.startswith("PostConfirmation_"):
        groups = _current_groups(user_pool_id, username)
        if not any(group in (APPLICANTS, RECRUITERS, ADMINS) for group in groups):
            _add_to_group(user_pool_id, username, _intended_group(attributes))
        return event

    if source.startswith("TokenGeneration_"):
        return _decorate_token(event, user_pool_id, username, attributes)

    return event


def _decorate_token(
    event: Dict[str, Any], user_pool_id: str, username: str, attributes: Dict[str, Any]
) -> Dict[str, Any]:
    groups = _current_groups(user_pool_id, username)
    known = [group for group in groups if group in (APPLICANTS, RECRUITERS, ADMINS)]

    if not known:
        intended = _intended_group(attributes)
        if _add_to_group(user_pool_id, username, intended):
            known = [intended]

    if not known:
        return event

    # The token is assembled from membership read before this trigger ran, so the
    # group is written into this token as well as into the pool. Without this an
    # account would need to sign in twice before anything worked.
    event.setdefault("response", {})["claimsOverrideDetails"] = {
        "groupOverrideDetails": {"groupsToOverride": known}
    }
    return event
