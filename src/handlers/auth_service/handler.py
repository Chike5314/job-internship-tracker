"""Profile and CV library.

Routes
    GET    /profile
    POST   /profile
    POST   /profile/upload-url
    POST   /profile/cvs
    GET    /profile/cvs

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

    # FR-2.7. The library entry is written by POST /profile/cvs once the upload
    # has landed, not here. Writing it at this point recorded every CV the
    # moment a URL was asked for, so an upload that failed or was abandoned left
    # an entry pointing at an object that was never created, and the applicant
    # was offered it for reuse on their next application.
    if kind == "cv":
        presigned["cv"] = {
            "label": optional_string(body, "label", max_length=120)
            or file_info["fileName"],
            "s3Key": key,
        }

    return created(presigned)


@router.route("POST", "/profile/cvs")
def confirm_cv_upload(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-2.7. Records a CV in the library, after its upload has landed.

    A presigned PUT goes straight from the browser to S3, so this call is the
    only way the API learns the transfer happened. It does not take the client's
    word for it: the object is checked before anything is written, which is what
    keeps an abandoned upload out of the library.

    Safe to call again. A retry that names the same key confirms to the same
    entry rather than adding a second one, because a browser retrying an upload
    it is unsure about is the normal case rather than an error.
    """
    caller = get_caller(event)
    caller.require("Applicants")
    body = parse_body(event)
    errors = Errors()
    key = require_string(errors, body, "s3Key", max_length=1024) or ""
    errors.raise_if_any()

    storage.assert_key_owned_by(key, caller.user_id)
    if not storage.object_exists(key):
        raise ValidationError(
            "That upload has not arrived yet. Finish it and try again.",
            {"s3Key": "No object at that key."},
        )

    profile = _ensure_user_record(caller)
    existing = list(profile.get("cvs") or [])
    for entry in existing:
        if entry.get("s3Key") == key:
            return ok({"cv": dynamo.from_dynamo(_cv_view(entry))})

    entry = {
        "cvId": cv_id(),
        "label": optional_string(body, "label", max_length=120) or key.rsplit("/", 1)[-1],
        "s3Key": key,
        "uploadedAt": now_iso(),
    }
    dynamo.users().update_item(
        Key={"userId": caller.user_id},
        UpdateExpression="SET cvs = list_append(if_not_exists(cvs, :empty), :entry)",
        ExpressionAttributeValues={":empty": [], ":entry": [entry]},
    )
    return created({"cv": dynamo.from_dynamo(_cv_view(entry))})


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

    return ok(
        {"cvs": [_cv_view(entry) for entry in recent], "totalUploaded": len(entries)}
    )


def _cv_view(entry: Dict[str, Any]) -> Dict[str, Any]:
    """One library row. The key never leaves as a key, per section 5.1."""
    return {**entry, "downloadUrl": storage.presigned_download(entry["s3Key"], entry.get("label"))}


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
