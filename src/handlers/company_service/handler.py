"""Company accounts and admin moderation.

Routes
    POST   /companies              register, which is also the verification request
    GET    /companies              admin listing by verification status
    GET    /companies/{id}         public details shown beside a posting
    PATCH  /companies/{id}         the account updating its own details
    PATCH  /companies/{id}/status  admin approval, rejection or suspension
    POST   /admin/companies        admin creating a company account directly
    GET    /admin/overview         platform level counts and the queue size

A recruiter account is the company. There is no separate person record behind
it, which is why the partition key here is the Cognito subject identifier.
"""
from typing import Any, Dict, List, Optional

from boto3.dynamodb.conditions import Key

from common import alerts, cognito, config, dynamo, email, notifications, storage
from common.access import assert_owns_company, get_company
from common.auth import get_caller
from common.errors import ConflictError, ValidationError
from common.responses import created, ok
from common.router import Router, api_handler, parse_body, path_param, query_params
from common.time_utils import now_iso
from common.validation import (
    Errors,
    VERIFICATION_STATUSES,
    coerce_bool,
    optional_string,
    optional_url,
    require_email,
    require_enum,
    require_https_url,
    require_string,
    validate_upload_request,
)

router = Router("company-service")

PENDING = "PENDING_VERIFICATION"
VERIFIED = "VERIFIED"
REJECTED = "REJECTED"
SUSPENDED = "SUSPENDED"

# What an admin may set, and from where. Approving a suspended account puts it
# straight back to verified rather than through pending again.
ADMIN_TRANSITIONS = {
    PENDING: {VERIFIED, REJECTED},
    VERIFIED: {SUSPENDED},
    REJECTED: {VERIFIED},
    SUSPENDED: {VERIFIED},
}


@router.route("POST", "/companies")
def register_company(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-3.1 and FR-3.3.

    Registration is the verification request. The record lands in
    PENDING_VERIFICATION and nothing it creates can reach applicants until an
    admin approves it.

    The route is authorizer protected. The record is keyed by the caller's
    Cognito subject, so there is no such thing as an anonymous registration: the
    recruiter has already signed up and holds a token by the time they reach
    this. Left public, as it was, the route had no authorizer, request context
    claims were never populated, and every call failed on the caller lookup.
    """
    caller = get_caller(event)
    body = parse_body(event)
    errors = Errors()

    company_name = require_string(errors, body, "companyName", max_length=200)
    contact_email = require_email(errors, body, "contactEmail")
    website = require_https_url(errors, body, "companyWebsiteUrl")
    errors.raise_if_any()

    item = {
        "companyId": caller.user_id,
        "companyName": company_name,
        "contactEmail": contact_email,
        "companyWebsiteUrl": website,
        "verificationStatus": PENDING,
        "createdAt": now_iso(),
    }
    office_address = optional_string(body, "officeAddress", max_length=500)
    if office_address:
        item["officeAddress"] = office_address
    maps_url = optional_url(body, "googleMapsUrl")
    if maps_url:
        item["googleMapsUrl"] = maps_url

    try:
        dynamo.companies().put_item(
            Item=item, ConditionExpression="attribute_not_exists(companyId)"
        )
    except dynamo.companies().meta.client.exceptions.ConditionalCheckFailedException:
        raise ConflictError("This account is already registered as a company.")

    notifications.record(
        caller.user_id,
        notifications.VERIFICATION_RESULT,
        "Your company registration was received and is waiting for review.",
        "/dashboard",
    )
    return created({"company": _public_view(item, full=True)})


@router.route("GET", "/companies/{id}")
def get_company_details(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-4.3. The website and map link an applicant uses to judge a posting.

    No authorizer, because an anonymous applicant reads this alongside a
    posting, so it serves the public view and nothing else. It used to widen the
    response for an admin or for the company itself, which never happened: a
    route with no authorizer never has request context claims populated, so the
    caller was always absent. The company reads its own full record through
    GET /companies/mine, and an admin through GET /companies.
    """
    company = get_company(path_param(event, "id"))
    return ok({"company": _public_view(company, full=False)})


@router.route("GET", "/companies/mine")
def get_my_company(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """The company's own record, in full, including its moderation history.

    The authorizer protected counterpart of GET /companies/{id}. A recruiter
    account is the company, so the identifier comes from the token rather than
    the path and there is nothing to authorise beyond the group.
    """
    caller = get_caller(event)
    caller.require("Recruiters", "Admins")
    company = get_company(caller.user_id)
    return ok({"company": _public_view(company, full=True)})


@router.route("POST", "/companies/logo-upload-url")
def company_logo_upload_url(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-5.4 and FR-5.5, for the one image a company owns.

    A presigned PUT scoped to one generated key under the company's own prefix.
    The record is not touched here: the client sends the key back on
    PATCH /companies/{id} once the upload has landed, the same two step shape the
    CV library uses, and for the same reason. A presigned URL is an offer, not an
    upload.
    """
    caller = get_caller(event)
    caller.require("Recruiters", "Admins")
    body = parse_body(event)
    errors = Errors()

    file_info = validate_upload_request(
        errors, body, image_allowed=True, max_bytes=config.MAX_UPLOAD_BYTES
    )
    errors.raise_if_any()

    key = storage.build_key(caller.user_id, "companyLogo", file_info["fileName"])
    return created(storage.presigned_upload(key, body.get("contentType")))


@router.route("PATCH", "/companies/{id}")
def update_company(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-3.8.

    A change to the name or the website is a change to the two things the admin
    actually checked, so the account returns to pending. Everything else can be
    corrected without losing verified standing.
    """
    caller = get_caller(event)
    caller.require("Recruiters", "Admins")
    company_id = path_param(event, "id")
    assert_owns_company(caller, company_id)

    company = get_company(company_id)
    body = parse_body(event)
    errors = Errors()
    changes: Dict[str, Any] = {}

    if "companyName" in body:
        changes["companyName"] = require_string(errors, body, "companyName", max_length=200)
    if "companyWebsiteUrl" in body:
        changes["companyWebsiteUrl"] = require_https_url(errors, body, "companyWebsiteUrl")
    if "contactEmail" in body:
        changes["contactEmail"] = require_email(errors, body, "contactEmail")
    if "officeAddress" in body:
        changes["officeAddress"] = optional_string(body, "officeAddress", max_length=500)
    if "googleMapsUrl" in body:
        changes["googleMapsUrl"] = optional_url(body, "googleMapsUrl")
    if "logoS3Key" in body:
        # A key sent back by the client has to be one issued to this same
        # company, otherwise an account could claim somebody else's upload.
        logo_key = optional_string(body, "logoS3Key", max_length=512)
        if logo_key:
            storage.assert_key_owned_by(logo_key, company_id)
            if not logo_key.startswith(storage.PREFIXES["companyLogo"] + "/"):
                raise ValidationError("That key is not a company logo.")
        changes["logoS3Key"] = logo_key
    errors.raise_if_any()

    if not changes:
        return ok({"company": _public_view(company, full=True)})

    changes = {k: v for k, v in changes.items() if v is not None}

    identity_changed = any(
        field in changes and changes[field] != company.get(field)
        for field in ("companyName", "companyWebsiteUrl")
    )
    was_verified = company.get("verificationStatus") == VERIFIED
    remove_fields = []
    if identity_changed and was_verified:
        changes["verificationStatus"] = PENDING
        # The approval no longer describes what the admin actually checked, so
        # it is cleared rather than left behind as a stale record.
        remove_fields = ["verifiedAt", "verifiedBy"]

    updated = _apply(company_id, changes, remove_fields)

    if identity_changed and was_verified:
        notifications.record(
            company_id,
            notifications.VERIFICATION_RESULT,
            "Your company details changed, so the account is waiting for review again.",
            "/dashboard",
        )
    return ok({"company": _public_view(updated, full=True)})


@router.route("PATCH", "/companies/{id}/status")
def set_verification_status(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-9.1, FR-9.2 and FR-9.4.

    Suspension unpublishes the account's active postings immediately, because a
    badge that says suspended while the postings stay visible would not be a
    moderation action at all.
    """
    caller = get_caller(event)
    caller.require("Admins")
    company_id = path_param(event, "id")
    company = get_company(company_id)

    body = parse_body(event)
    errors = Errors()
    target = require_enum(errors, body, "verificationStatus", VERIFICATION_STATUSES)
    errors.raise_if_any()

    current = company.get("verificationStatus", PENDING)
    if target not in ADMIN_TRANSITIONS.get(current, set()):
        raise ConflictError(
            f"An account that is {current.lower().replace('_', ' ')} cannot be "
            f"set to {target.lower().replace('_', ' ')}.",
            {"currentStatus": current, "allowedNext": sorted(ADMIN_TRANSITIONS.get(current, set()))},
        )

    note = optional_string(body, "note", max_length=500) or ""
    changes: Dict[str, Any] = {
        "verificationStatus": target,
        "verifiedBy": caller.user_id,
        "verifiedAt": now_iso(),
        "moderationNote": note,
        # FR-9.4. Appended rather than written over, so a second decision does
        # not erase the reason given for the first one. An account that was
        # suspended and later restored should still show why it was suspended.
        "moderationHistory": list(company.get("moderationHistory") or [])
        + [
            {
                "from": current,
                "to": target,
                "by": caller.user_id,
                "note": note,
                "timestamp": now_iso(),
            }
        ],
    }

    # FR-8.2. The alert subscription follows the account's standing, so a
    # suspended account stops receiving application alerts along with everything
    # else it loses.
    if target == VERIFIED and not str(company.get("alertSubscriptionArn", "")).startswith("arn:"):
        subscription = alerts.subscribe_company(company_id, company.get("contactEmail", ""))
        if subscription:
            changes["alertSubscriptionArn"] = subscription
    elif target in (SUSPENDED, REJECTED):
        if alerts.unsubscribe(company.get("alertSubscriptionArn")):
            changes["alertSubscriptionArn"] = ""

    updated = _apply(company_id, changes)

    unpublished = 0
    if target in (SUSPENDED, REJECTED):
        unpublished = _unpublish_active_postings(company_id)

    _announce_verification(company, target, note)
    return ok(
        {
            "company": _public_view(updated, full=True),
            "postingsUnpublished": unpublished,
        }
    )


@router.route("POST", "/admin/companies")
def admin_create_company(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """An admin onboarding a company that is not going to register itself.

    A recruiter account is a Cognito account, and companyId is that account's
    subject identifier, so there is no such thing here as a company record
    waiting for somebody to claim it. Creating the company therefore means
    creating the account: Cognito emails the address a temporary password, the
    account is placed in Recruiters, and the record is written against the new
    subject identifier.

    The account is created already verified by default, because an admin typing
    the details in has done the checking that verification represents. Pass
    verifyNow as false to put it through the normal queue instead.
    """
    caller = get_caller(event)
    caller.require("Admins")
    body = parse_body(event)
    errors = Errors()

    company_name = require_string(errors, body, "companyName", max_length=200)
    contact_email = require_email(errors, body, "contactEmail")
    website = require_https_url(errors, body, "companyWebsiteUrl")
    errors.raise_if_any()

    verify_now = coerce_bool(body.get("verifyNow", True), default=True)

    try:
        created_account = cognito.admin_create_recruiter(
            email=contact_email, company_name=company_name
        )
    except cognito.AccountExistsError:
        raise ConflictError(
            "An account already exists for that email address.",
            {"contactEmail": contact_email},
        )
    except cognito.CognitoUnavailableError:
        raise ConflictError(
            "The account could not be created. Check the address and try again."
        )

    company_id = created_account["userId"]
    now = now_iso()
    item: Dict[str, Any] = {
        "companyId": company_id,
        "companyName": company_name,
        "contactEmail": contact_email,
        "companyWebsiteUrl": website,
        "verificationStatus": VERIFIED if verify_now else PENDING,
        "createdAt": now,
        "createdByAdmin": caller.user_id,
        "moderationHistory": [
            {
                "from": "NONE",
                "to": VERIFIED if verify_now else PENDING,
                "by": caller.user_id,
                "note": "Account created by an administrator.",
                "timestamp": now,
            }
        ],
    }
    office_address = optional_string(body, "officeAddress", max_length=500)
    if office_address:
        item["officeAddress"] = office_address
    maps_url = optional_url(body, "googleMapsUrl")
    if maps_url:
        item["googleMapsUrl"] = maps_url
    if verify_now:
        item["verifiedBy"] = caller.user_id
        item["verifiedAt"] = now
        subscription = alerts.subscribe_company(company_id, contact_email)
        if subscription:
            item["alertSubscriptionArn"] = subscription

    dynamo.companies().put_item(Item=item)

    notifications.record(
        company_id,
        notifications.VERIFICATION_RESULT,
        (
            "An administrator created this company account for you. "
            + (
                "It is verified, so you can publish postings."
                if verify_now
                else "It is waiting for review."
            )
        ),
        "/dashboard",
    )
    email.send(
        contact_email,
        f"An account has been created for {company_name}",
        (
            f"An administrator created a recruiter account for {company_name}.\n\n"
            f"Sign in with {contact_email} and the temporary password sent to you "
            f"separately, then set a password of your own.\n\n"
            + ("The account is verified and can publish postings." if verify_now
               else "The account is waiting for verification.")
        ),
    )

    return created(
        {
            "company": _public_view(item, full=True),
            "accountCreated": True,
            "temporaryPasswordSentTo": contact_email,
        }
    )


@router.route("GET", "/admin/overview")
def admin_overview(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-9.5. Platform level counts of users, companies, postings and applications.

    These come from the table metadata DynamoDB already keeps rather than from a
    scan. That figure is refreshed roughly every six hours, so it is described as
    approximate in the response instead of being presented as exact. A count that
    has to be exact would need a counter maintained on write, which is not worth
    adding for a figure nobody acts on.
    """
    caller = get_caller(event)
    caller.require("Admins")

    counts = {
        "users": dynamo.approximate_count(dynamo.users()),
        "companies": dynamo.approximate_count(dynamo.companies()),
        "postings": dynamo.approximate_count(dynamo.jobs()),
        "applications": dynamo.approximate_count(dynamo.applications()),
    }

    # The verification queue is the number an admin actually acts on, so it is
    # counted exactly off the index rather than read from table metadata.
    pending = dynamo.query_all(
        dynamo.companies(),
        key_condition=Key("verificationStatus").eq(PENDING),
        index_name="VerificationStatusIndex",
        limit=500,
    )

    return ok(
        {
            "approximateCounts": counts,
            "countsAreApproximate": True,
            "awaitingVerification": len(pending),
        }
    )


@router.route("GET", "/companies")
def list_companies(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-9.3. Served by VerificationStatusIndex rather than by a table scan."""
    caller = get_caller(event)
    caller.require("Admins")

    params = query_params(event)
    status = params.get("status", PENDING)
    if status not in VERIFICATION_STATUSES:
        raise ValidationError(
            "Filter by one of: " + ", ".join(sorted(VERIFICATION_STATUSES)) + "."
        )

    items = dynamo.query_all(
        dynamo.companies(),
        key_condition=Key("verificationStatus").eq(status),
        index_name="VerificationStatusIndex",
        limit=200,
    )
    return ok(
        {
            "status": status,
            "count": len(items),
            "companies": [_public_view(item, full=True) for item in items],
        }
    )


def _apply(
    company_id: str,
    changes: Dict[str, Any],
    remove_fields: Optional[List[str]] = None,
) -> Dict[str, Any]:
    expression, names, values = dynamo.build_update(changes)
    if remove_fields:
        aliases = []
        for index, field in enumerate(remove_fields):
            alias = f"#r{index}"
            names[alias] = field
            aliases.append(alias)
        expression = f"{expression} REMOVE " + ", ".join(aliases)
    return dynamo.companies().update_item(
        Key={"companyId": company_id},
        UpdateExpression=expression,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
        ReturnValues="ALL_NEW",
    )["Attributes"]


def _unpublish_active_postings(company_id: str) -> int:
    """FR-3.5. Every published posting of a suspended account comes down."""
    postings: List[Dict[str, Any]] = dynamo.query_all(
        dynamo.jobs(),
        key_condition=Key("companyId").eq(company_id),
        index_name="CompanyIndex",
        limit=500,
    )
    changed = 0
    for posting in postings:
        if posting.get("postingStatus") != "PUBLISHED":
            continue
        dynamo.jobs().update_item(
            Key={"jobId": posting["jobId"]},
            UpdateExpression="SET postingStatus = :closed, unpublishedAt = :now",
            ExpressionAttributeValues={":closed": "CLOSED", ":now": now_iso()},
        )
        changed += 1
    return changed


def _announce_verification(company: Dict[str, Any], target: str, note: str) -> None:
    """FR-3.7 and FR-12.1. The record is written whether or not the email lands."""
    wording = {
        VERIFIED: "Your company account has been verified. You can publish postings now.",
        REJECTED: "Your company verification request was not approved.",
        SUSPENDED: "Your company account has been suspended and your postings are no longer visible.",
        PENDING: "Your company account is waiting for review.",
    }[target]
    if note:
        wording = f"{wording} Note from the reviewer: {note}"

    notifications.record(
        company["companyId"], notifications.VERIFICATION_RESULT, wording, "/dashboard"
    )
    email.send(
        company.get("contactEmail", ""),
        f"Verification update for {company.get('companyName', 'your company')}",
        wording,
    )


def _public_view(company: Dict[str, Any], *, full: bool) -> Dict[str, Any]:
    view = {
        "companyId": company.get("companyId"),
        "companyName": company.get("companyName"),
        "companyWebsiteUrl": company.get("companyWebsiteUrl"),
        "googleMapsUrl": company.get("googleMapsUrl"),
        "officeAddress": company.get("officeAddress"),
        "verificationStatus": company.get("verificationStatus"),
    }
    # Section 5.1: an S3 key never leaves the API as a key. The logo is swapped
    # for a presigned URL at the moment it is read, like every other document.
    if company.get("logoS3Key"):
        view["logoUrl"] = storage.presigned_download(company["logoS3Key"])
    if full:
        view.update(
            {
                "contactEmail": company.get("contactEmail"),
                "verifiedAt": company.get("verifiedAt"),
                "verifiedBy": company.get("verifiedBy"),
                "moderationNote": company.get("moderationNote"),
                # FR-9.8. The admin screen shows why each earlier decision was
                # taken, which is the whole point of keeping the history.
                "moderationHistory": company.get("moderationHistory"),
                "createdByAdmin": company.get("createdByAdmin"),
                "createdAt": company.get("createdAt"),
            }
        )
    return {k: v for k, v in view.items() if v is not None}


lambda_handler = api_handler(router)
