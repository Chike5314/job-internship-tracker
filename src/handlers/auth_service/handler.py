"""Profile and CV library.

Routes
    GET    /profile
    POST   /profile
    POST   /profile/upload-url
    GET    /profile/cvs
    POST   /profile/cvs

FR-1.6 is handled here rather than in a Cognito trigger. The first authenticated
call from an account finds no record and creates one, which covers applicants
arriving through Google federation as well as those who signed up with a
password.
"""
from typing import Any, Dict, List

from common import config, dynamo, storage
from common.auth import Caller, get_caller
from common.errors import ValidationError
from common.ids import cv_id
from common.responses import created, ok
from common.router import Router, api_handler, parse_body
from common.time_utils import now_iso
from common.validation import (
    Errors,
    optional_string,
    optional_string_list,
    require_enum,
    require_string,
    validate_upload_request,
)

router = Router("auth-service")

# What a caller may ask for an upload URL for on the profile route. The
# application route in application_service covers everything written for one
# specific posting.
PROFILE_UPLOAD_KINDS = {"cv", "transcript", "profilePicture"}
DEGREE_LEVELS = {"HND", "BACHELORS", "MASTERS", "DOCTORATE", "OTHER"}


def _ensure_user_record(caller: Caller) -> Dict[str, Any]:
    """FR-1.6. Create the Users record the first time this account is seen."""
    table = dynamo.users()
    existing = table.get_item(Key={"userId": caller.user_id}).get("Item")
    if existing:
        return existing

    item = {
        "userId": caller.user_id,
        "email": caller.email,
        "role": "ADMIN" if caller.is_admin else "APPLICANT",
        "fullName": caller.name or caller.email.split("@")[0],
        "cvs": [],
        "createdAt": now_iso(),
    }
    table.put_item(Item=item, ConditionExpression="attribute_not_exists(userId)")
    return item


@router.route("GET", "/profile")
def get_profile(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    caller = get_caller(event)
    profile = _ensure_user_record(caller)
    return ok({"profile": _presentable(profile)})


@router.route("POST", "/profile")
def upsert_profile(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-2.1 and FR-2.2.

    Academic details sit here as optional fields. They are only ever enforced at
    the moment an applicant applies to a posting that asks for them, which is
    what keeps a working professional from being asked for a transcript.
    """
    caller = get_caller(event)
    body = parse_body(event)
    errors = Errors()

    existing = _ensure_user_record(caller)
    changes: Dict[str, Any] = {}

    full_name = optional_string(body, "fullName", max_length=120)
    if full_name:
        changes["fullName"] = full_name
    phone = optional_string(body, "phone", max_length=32)
    if phone is not None:
        changes["phone"] = phone

    skills = optional_string_list(body, "skills", limit=40)
    if skills is not None:
        changes["skills"] = skills

    academic = body.get("academicInfo")
    if isinstance(academic, dict):
        degree_level = None
        if academic.get("degreeLevel"):
            degree_level = require_enum(errors, academic, "degreeLevel", DEGREE_LEVELS)
        changes["academicInfo"] = {
            k: v
            for k, v in {
                "schoolName": optional_string(academic, "schoolName", max_length=200),
                "fieldOfStudy": optional_string(academic, "fieldOfStudy", max_length=200),
                "degreeLevel": degree_level,
            }.items()
            if v
        }

    # A key sent back by the client has to be one issued to this same caller,
    # otherwise an account could claim somebody else's document.
    for field, kind in (("profilePicUrl", "profilePicture"), ("transcriptS3Key", "transcript")):
        key = optional_string(body, field, max_length=512)
        if key:
            storage.assert_key_owned_by(key, caller.user_id)
            changes[field] = key

    errors.raise_if_any()

    if not changes:
        return ok({"profile": _presentable(existing)})

    expression, names, values = dynamo.build_update(changes)
    updated = dynamo.users().update_item(
        Key={"userId": caller.user_id},
        UpdateExpression=expression,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
        ReturnValues="ALL_NEW",
    )["Attributes"]
    return ok({"profile": _presentable(updated)})


@router.route("POST", "/profile/upload-url")
def profile_upload_url(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-5.4 and FR-5.5. A presigned PUT scoped to one generated key."""
    caller = get_caller(event)
    body = parse_body(event)
    errors = Errors()

    kind = require_enum(errors, body, "documentKind", PROFILE_UPLOAD_KINDS)
    file_info = validate_upload_request(
        errors,
        body,
        image_allowed=body.get("documentKind") == "profilePicture",
        max_bytes=config.MAX_UPLOAD_BYTES,
    )
    errors.raise_if_any()

    key = storage.build_key(caller.user_id, kind, file_info["fileName"])
    presigned = storage.presigned_upload(key, body.get("contentType"))

    # FR-2.7. A CV upload is remembered so it can be offered for reuse later,
    # but not here. A presigned URL is an offer, not an upload: the transfer
    # happens between the browser and S3, and it can be abandoned, fail, or
    # expire unused. Written at this point the library filled up with entries
    # pointing at keys that had no object behind them, and the reuse list then
    # offered CVs that could not be downloaded. The entry is written by
    # POST /profile/cvs once the upload has actually landed.
    if kind == "cv":
        presigned["cv"] = {
            "s3Key": key,
            "label": optional_string(body, "label", max_length=120)
            or file_info["fileName"],
        }

    return created(presigned)


@router.route("POST", "/profile/cvs")
def confirm_cv_upload(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-2.7. Record a CV in the library once its upload has landed.

    Called by the client after the presigned PUT succeeds. The object is checked
    for rather than taken on trust, so a client that reports an upload it never
    made still cannot put an empty entry in the library.
    """
    caller = get_caller(event)
    body = parse_body(event)
    errors = Errors()

    key = require_string(errors, body, "s3Key", max_length=512)
    label = optional_string(body, "label", max_length=120)
    errors.raise_if_any()

    storage.assert_key_owned_by(key, caller.user_id)
    if not key.startswith(storage.PREFIXES["cv"] + "/"):
        raise ValidationError("That key is not a CV.")
    if not storage.object_exists(key):
        raise ValidationError("That upload has not arrived yet. Try again once it finishes.")

    profile = _ensure_user_record(caller)

    # Confirming twice is the same confirmation, not a second CV. The client
    # retries this call on a flaky connection, and a retry must not leave the
    # library holding the same document under two identifiers.
    for existing in profile.get("cvs") or []:
        if existing.get("s3Key") == key:
            return ok({"cv": existing})

    entry = {
        "cvId": cv_id(),
        "label": label or key.rsplit("-", 1)[-1],
        "s3Key": key,
        "uploadedAt": now_iso(),
    }
    dynamo.users().update_item(
        Key={"userId": caller.user_id},
        UpdateExpression="SET cvs = list_append(if_not_exists(cvs, :empty), :entry)",
        ExpressionAttributeValues={":empty": [], ":entry": [entry]},
    )
    return created({"cv": entry})


@router.route("GET", "/profile/cvs")
def list_cvs(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-2.7.

    This is the upload history shown back to the applicant, newest first. There
    is no version chain and no default: every application asks for a CV, and an
    earlier upload is offered alongside as a shortcut.
    """
    caller = get_caller(event)
    caller.require("Applicants", "Admins")
    profile = _ensure_user_record(caller)

    entries: List[Dict[str, Any]] = list(profile.get("cvs") or [])
    entries.sort(key=lambda item: item.get("uploadedAt", ""), reverse=True)
    recent = entries[: config.CV_REUSE_LIMIT]

    for entry in recent:
        entry["downloadUrl"] = storage.presigned_download(
            entry["s3Key"], entry.get("label")
        )

    return ok({"cvs": recent, "totalUploaded": len(entries)})


def _presentable(profile: Dict[str, Any]) -> Dict[str, Any]:
    """S3 keys never leave the API as keys.

    Section 5.1 requires the dashboard to receive a presigned URL rather than an
    object key, so the key is swapped for one here at the moment it is needed.
    """
    shown = {k: v for k, v in profile.items() if k not in ("profilePicUrl", "transcriptS3Key")}
    if profile.get("profilePicUrl"):
        shown["profilePictureUrl"] = storage.presigned_download(profile["profilePicUrl"])
    if profile.get("transcriptS3Key"):
        shown["hasTranscript"] = True
        shown["transcriptUrl"] = storage.presigned_download(profile["transcriptS3Key"])
    shown["cvCount"] = len(profile.get("cvs") or [])
    shown.pop("cvs", None)
    return shown


lambda_handler = api_handler(router)
