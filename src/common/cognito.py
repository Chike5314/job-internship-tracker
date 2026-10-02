"""Account creation from the admin side.

This is the only place in the system that creates a Cognito account. Everything
else lets people sign themselves up, and the identity trigger puts them in a
group from there.

FR-1.3 still holds. Nothing here can create an admin: the only group this module
will ever write is Recruiters.
"""
import functools
import logging
from typing import Any, Dict

import boto3

from common import config

logger = logging.getLogger(__name__)

RECRUITERS = "Recruiters"


class AccountExistsError(Exception):
    """An account already exists for that email address."""


class CognitoUnavailableError(Exception):
    """Cognito refused the request for a reason the caller cannot fix."""


@functools.lru_cache(maxsize=1)
def _idp():
    return boto3.client("cognito-idp")


def admin_create_recruiter(*, email: str, company_name: str) -> Dict[str, Any]:
    """Creates a recruiter account and returns its subject identifier.

    Cognito generates the temporary password and emails it, so no password is
    ever chosen, logged or returned here. The account is created in a state that
    forces a password change at first sign in.
    """
    if not config.USER_POOL_ID:
        raise CognitoUnavailableError("no user pool is configured")

    client = _idp()
    try:
        response = client.admin_create_user(
            UserPoolId=config.USER_POOL_ID,
            Username=email,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "name", "Value": company_name},
                {"Name": "custom:accountType", "Value": "company"},
                {"Name": "custom:companyName", "Value": company_name[:256]},
            ],
            DesiredDeliveryMediums=["EMAIL"],
        )
    except client.exceptions.UsernameExistsException:
        raise AccountExistsError(email)
    except Exception as exc:  # noqa: BLE001
        logger.exception("admin_create_user failed")
        raise CognitoUnavailableError(str(exc)) from exc

    attributes = {
        attribute["Name"]: attribute["Value"]
        for attribute in response.get("User", {}).get("Attributes", [])
    }
    user_id = attributes.get("sub")
    username = response.get("User", {}).get("Username", email)
    if not user_id:
        raise CognitoUnavailableError("the created account has no subject identifier")

    try:
        client.admin_add_user_to_group(
            UserPoolId=config.USER_POOL_ID, Username=username, GroupName=RECRUITERS
        )
    except Exception as exc:  # noqa: BLE001
        # The account exists but cannot act as a recruiter, which is worse than
        # no account at all, so it is removed rather than left half configured.
        logger.exception("could not place a new account in the recruiter group")
        try:
            client.admin_delete_user(
                UserPoolId=config.USER_POOL_ID, Username=username
            )
        except Exception:  # noqa: BLE001
            logger.exception("could not roll back a half created account")
        raise CognitoUnavailableError(str(exc)) from exc

    return {"userId": user_id, "username": username, "email": email}
