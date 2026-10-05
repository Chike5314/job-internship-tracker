"""Applications, their documents, their status and their interviews.

Routes
    POST   /applications
    POST   /applications/upload-url
    GET    /applications/me
    GET    /applications/{id}
    PATCH  /applications/{id}
    PATCH  /applications/{id}/status
    POST   /applications/{id}/interview
    PATCH  /applications/{id}/interview
"""
import functools
import json
from typing import Any, Dict, List, Optional

import boto3
from boto3.dynamodb.conditions import Key

from common import config, documents, dynamo, storage
from common import interviews as interview_calendar
from common.access import (
    assert_can_read_application,
    find_company,
    find_user,
    get_application,
    get_job,
)
from common.auth import get_caller
from common.errors import (
    ApplicationFrozenError,
    DuplicateApplicationError,
    ForbiddenError,
    NotFoundError,
    PostingNotOpenError,
    ValidationError,
)
from common.ids import applicant_job_key, application_id as new_application_id, interview_id
from common.responses import accepted, created, ok
from common.router import Router, api_handler, parse_body, path_param, query_params
from common.state_machine import (
    ALL_STATUSES,
    FINAL_STATUSES,
    INTERVIEW_SCHEDULED,
    SUBMITTED,
    UNDER_REVIEW,
    assert_transition,
    history_entry,
)
from common.time_utils import is_past, now_iso
from common.validation import (
    INTERVIEW_MODES,
    Errors,
    optional_int,
    optional_iso_datetime,
    optional_string,
    require_enum,
    require_string,
    validate_upload_request,
)

router = Router("application-service")

INTERVIEW_PROPOSED = "PROPOSED"
INTERVIEW_CONFIRMED = "CONFIRMED"
INTERVIEW_DECLINED = "DECLINED"
INTERVIEW_CANCELLED = "CANCELLED"


@functools.lru_cache(maxsize=1)
def _sqs():
    return boto3.client("sqs")


# ----------------------------------------------------------------------
# Upload
# ----------------------------------------------------------------------
@router.route("POST", "/applications/upload-url")
def application_upload_url(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-5.4 and FR-5.5.

    The kind asked for has to be something the target posting actually wants, so
    a posting that dropped the authorisation letter will not hand out a URL for
    one.
    """
    caller = get_caller(event)
    caller.require("Applicants")
    body = parse_body(event)
    errors = Errors()

    job_id_value = require_string(errors, body, "jobId", max_length=80)
    document_key = require_string(errors, body, "documentKey", max_length=40)
    file_info = validate_upload_request(
        errors, body, image_allowed=False, max_bytes=config.MAX_UPLOAD_BYTES
    )
    errors.raise_if_any()

    job = get_job(job_id_value)
    requirements = job.get("documentRequirements") or []
    requirement = documents.requirement_for(requirements, document_key)
    if requirement is None or requirement.get("kind", "FILE") != "FILE":
        raise ValidationError(
            "This posting does not ask for that document.",
            {"requirements": requirements},
        )

    key = storage.build_key(caller.user_id, document_key, file_info["fileName"])
    presigned = storage.presigned_upload(key, body.get("contentType"))
    presigned["documentKey"] = document_key
    return created(presigned)


# ----------------------------------------------------------------------
# Submission
# ----------------------------------------------------------------------
@router.route("POST", "/applications")
def submit_application(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-5.1 to FR-5.12.

    The posting decides what is required. The write is conditional on the
    applicant and posting pair, which is what actually stops a duplicate rather
    than a read followed by a write.
    """
    caller = get_caller(event)
    caller.require("Applicants")
    body = parse_body(event)
    errors = Errors()

    job_id_value = require_string(errors, body, "jobId", max_length=80)
    errors.raise_if_any()

    job = get_job(job_id_value)
    _assert_posting_open(job)

    requirements = job.get("documentRequirements") or []
    supplied_documents = storage_keys_from(body.get("documents"), caller.user_id)
    answers = documents.strip_unknown(requirements, body.get("answers") or {}, "TEXT")
    supplied_documents = documents.strip_unknown(requirements, supplied_documents, "FILE")

    # FR-5.10. A CV always comes with the application, either freshly uploaded
    # or picked from the applicant's earlier uploads.
    reuse_cv_id = optional_string(body, "reuseCvId", max_length=80)
    if reuse_cv_id and not supplied_documents.get(documents.CV):
        supplied_documents[documents.CV] = _resolve_reused_cv(caller.user_id, reuse_cv_id)

    _attach_profile_transcript(caller.user_id, requirements, supplied_documents)
    documents.validate_submission(requirements, supplied_documents, answers)

    cover_letter = optional_string(body, "coverLetter", max_length=10000)
    item = {
        "applicationId": new_application_id(),
        "applicantId": caller.user_id,
        "jobId": job["jobId"],
        "applicantJobKey": applicant_job_key(caller.user_id, job["jobId"]),
        # Copied from the posting so account level analytics do not need a
        # second lookup per application. Neither value changes for an existing
        # posting, so the duplication is safe.
        "companyId": job["companyId"],
        "opportunityType": job.get("opportunityType"),
        "status": SUBMITTED,
        "statusHistory": [history_entry(SUBMITTED, caller.user_id, "Application submitted.")],
        "documents": supplied_documents,
        "answers": answers,
        "appliedAt": now_iso(),
    }
    if cover_letter:
        item["coverLetter"] = cover_letter

    # FR-5.3. The ordinary case is caught by this read.
    if _duplicate_exists(caller.user_id, job["jobId"]):
        raise DuplicateApplicationError(
            "You have already applied to this posting.", {"jobId": job["jobId"]}
        )

    table = dynamo.applications()
    table.put_item(Item=dynamo.to_dynamo(item))

    # Two submissions sent at the same moment can both pass the read above, so
    # the write is followed by a second look and the loser removes itself. The
    # index is eventually consistent, so this narrows the window rather than
    # closing it outright, which is why the interface also routes a repeat
    # applicant to their existing application.
    if _duplicate_exists(caller.user_id, job["jobId"], keep_id=item["applicationId"]):
        table.delete_item(Key={"applicationId": item["applicationId"]})
        raise DuplicateApplicationError(
            "You have already applied to this posting.", {"jobId": job["jobId"]}
        )

    _enqueue_submission(item["applicationId"], job["jobId"], caller.user_id)

    # FR-5.9. The applicant is acknowledged without waiting for parsing, the
    # recruiter alert or the confirmation email.
    return accepted(
        {
            "application": _applicant_view(item, job),
            "message": "Your application was received.",
        }
    )


def storage_keys_from(raw: Any, owner_id: str) -> Dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    keys: Dict[str, str] = {}
    for document_key, value in raw.items():
        if not value:
            continue
        key = str(value)[:512]
        storage.assert_key_owned_by(key, owner_id)
        keys[str(document_key)[:40]] = key
    return keys


def _resolve_reused_cv(applicant_id: str, cv_identifier: str) -> str:
    profile = find_user(applicant_id)
    for entry in profile.get("cvs") or []:
        if entry.get("cvId") == cv_identifier:
            return entry["s3Key"]
    raise ValidationError("That CV is not one of your earlier uploads.")


def _attach_profile_transcript(
    applicant_id: str, requirements: List[Dict[str, Any]], supplied: Dict[str, str]
) -> None:
    """FR-2.1. The transcript kept on the profile goes with every application
    whose posting asks for one, unless the applicant attached a different one.

    The key is copied onto the application rather than looked up later, and
    storage never overwrites a key, so the application keeps the transcript it
    was sent with even after the profile's is replaced.
    """
    asks = any(
        requirement.get("key") == documents.TRANSCRIPT
        and requirement.get("kind", "FILE") == "FILE"
        for requirement in requirements
    )
    if not asks or supplied.get(documents.TRANSCRIPT):
        return
    transcript_key = find_user(applicant_id).get("transcriptS3Key")
    if transcript_key:
        supplied[documents.TRANSCRIPT] = transcript_key


def _assert_posting_open(job: Dict[str, Any]) -> None:
    """FR-5.6 and FR-5.7. The refusal says which of the two conditions applied."""
    if job.get("postingStatus") != "PUBLISHED":
        raise PostingNotOpenError("This posting is not accepting applications.")
    if job.get("applicationDeadline") and is_past(job["applicationDeadline"]):
        raise PostingNotOpenError("The deadline for this posting has passed.")


def _duplicate_exists(
    applicant_id: str, job_id_value: str, keep_id: Optional[str] = None
) -> bool:
    items = dynamo.query_all(
        dynamo.applications(),
        key_condition=Key("applicantJobKey").eq(applicant_job_key(applicant_id, job_id_value)),
        index_name="ApplicantJobIndex",
        limit=5,
    )
    return any(item.get("applicationId") != keep_id for item in items)


def _enqueue_submission(application_id: str, job_id_value: str, applicant_id: str) -> None:
    """FR-8.3 and FR-8.6.

    A queue failure is logged and the submission still stands, because the
    application record is already written and losing it over a messaging problem
    would be the worse outcome.
    """
    if not config.SUBMISSION_QUEUE_URL:
        return
    try:
        _sqs().send_message(
            QueueUrl=config.SUBMISSION_QUEUE_URL,
            MessageBody=json.dumps(
                {
                    "type": "APPLICATION_SUBMITTED",
                    "applicationId": application_id,
                    "jobId": job_id_value,
                    "applicantId": applicant_id,
                }
            ),
        )
    except Exception:  # noqa: BLE001
        import logging

        logging.getLogger(__name__).exception(
            "submission %s could not be queued", application_id
        )


# ----------------------------------------------------------------------
# Reading
# ----------------------------------------------------------------------
@router.route("GET", "/applications/me")
def list_my_applications(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-6.7. Served by ApplicantIndex, newest first."""
    caller = get_caller(event)
    caller.require("Applicants")

    params = query_params(event)
    items = dynamo.query_all(
        dynamo.applications(),
        key_condition=Key("applicantId").eq(caller.user_id),
        index_name="ApplicantIndex",
        limit=200,
    )
    if params.get("status") in ALL_STATUSES:
        items = [item for item in items if item.get("status") == params["status"]]

    job_cache: Dict[str, Dict[str, Any]] = {}
    rows = []
    for item in items:
        job_id_value = item.get("jobId", "")
        if job_id_value not in job_cache:
            job_cache[job_id_value] = (
                dynamo.jobs().get_item(Key={"jobId": job_id_value}).get("Item") or {}
            )
        rows.append(_applicant_view(item, job_cache[job_id_value]))

    return ok({"count": len(rows), "applications": rows})


@router.route("GET", "/applications/{id}")
def get_application_detail(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-6.10.

    A recruiter opening this view is what freezes the application. The move to
    UNDER_REVIEW is written conditionally so that two recruiters opening it at
    the same moment produce one history entry rather than two.
    """
    caller = get_caller(event)
    application = get_application(path_param(event, "id"))
    assert_can_read_application(caller, application)

    if (
        caller.is_recruiter
        and not caller.is_admin
        and application.get("status") == SUBMITTED
    ):
        application = _open_for_review(application, caller.user_id)

    job = dynamo.jobs().get_item(Key={"jobId": application["jobId"]}).get("Item") or {}

    if caller.is_applicant and application.get("applicantId") == caller.user_id:
        return ok({"application": _applicant_view(application, job, detailed=True)})
    return ok({"application": _recruiter_view(application, job)})


def _open_for_review(application: Dict[str, Any], recruiter_id: str) -> Dict[str, Any]:
    table = dynamo.applications()
    try:
        return table.update_item(
            Key={"applicationId": application["applicationId"]},
            UpdateExpression=(
                "SET #s = :review, statusHistory = "
                "list_append(if_not_exists(statusHistory, :empty), :entry)"
            ),
            ConditionExpression="#s = :submitted",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":review": UNDER_REVIEW,
                ":submitted": SUBMITTED,
                ":empty": [],
                ":entry": [
                    history_entry(UNDER_REVIEW, recruiter_id, "Opened by the recruiter.")
                ],
            },
            ReturnValues="ALL_NEW",
        )["Attributes"]
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        # Somebody else opened it first, which is a fine outcome.
        return get_application(application["applicationId"])


# ----------------------------------------------------------------------
# Amendment
# ----------------------------------------------------------------------
@router.route("PATCH", "/applications/{id}")
def amend_application(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-5.13 to FR-5.15.

    Editable while the application is still SUBMITTED. The posting it targets is
    never editable, since a different posting is a different application.
    """
    caller = get_caller(event)
    caller.require("Applicants")
    application = get_application(path_param(event, "id"))
    if application.get("applicantId") != caller.user_id:
        raise ForbiddenError("You are not allowed to change this application.")

    if application.get("status") != SUBMITTED:
        raise ApplicationFrozenError(
            "This application is already under review and can no longer be changed.",
            {"currentStatus": application.get("status")},
        )

    job = get_job(application["jobId"])
    _assert_posting_open(job)
    requirements = job.get("documentRequirements") or []

    body = parse_body(event)
    merged_documents = dict(application.get("documents") or {})
    merged_answers = dict(application.get("answers") or {})

    if "documents" in body:
        incoming = storage_keys_from(body.get("documents"), caller.user_id)
        merged_documents.update(documents.strip_unknown(requirements, incoming, "FILE"))
    if body.get("reuseCvId"):
        merged_documents[documents.CV] = _resolve_reused_cv(
            caller.user_id, str(body["reuseCvId"])
        )
    if "answers" in body:
        merged_answers.update(
            documents.strip_unknown(requirements, body.get("answers") or {}, "TEXT")
        )

    _attach_profile_transcript(caller.user_id, requirements, merged_documents)
    documents.validate_submission(requirements, merged_documents, merged_answers)

    changes: Dict[str, Any] = {
        "documents": merged_documents,
        "answers": merged_answers,
        "lastEditedAt": now_iso(),
    }
    if "coverLetter" in body:
        changes["coverLetter"] = optional_string(body, "coverLetter", max_length=10000) or ""

    expression, names, values = dynamo.build_update(changes)
    try:
        updated = dynamo.applications().update_item(
            Key={"applicationId": application["applicationId"]},
            UpdateExpression=expression,
            ConditionExpression="#st = :submitted",
            ExpressionAttributeNames={**names, "#st": "status"},
            ExpressionAttributeValues={**values, ":submitted": SUBMITTED},
            ReturnValues="ALL_NEW",
        )["Attributes"]
    except dynamo.applications().meta.client.exceptions.ConditionalCheckFailedException:
        # A recruiter opened it between the read and the write.
        raise ApplicationFrozenError(
            "A recruiter opened this application while you were editing, so it is "
            "now frozen."
        )

    return ok({"application": _applicant_view(updated, job, detailed=True)})


# ----------------------------------------------------------------------
# Status
# ----------------------------------------------------------------------
@router.route("PATCH", "/applications/{id}/status")
def change_status(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-6.2 to FR-6.6. One conditional write covers the status and its history."""
    caller = get_caller(event)
    application = get_application(path_param(event, "id"))

    if caller.is_recruiter and application.get("companyId") == caller.user_id:
        actor_role = "RECRUITER"
    elif caller.is_applicant and application.get("applicantId") == caller.user_id:
        actor_role = "APPLICANT"
    else:
        raise ForbiddenError("You are not allowed to change this application.")

    body = parse_body(event)
    errors = Errors()
    target = require_enum(errors, body, "status", ALL_STATUSES)
    note = optional_string(body, "note", max_length=500) or ""
    errors.raise_if_any()

    current = application.get("status", "")
    assert_transition(current, target, actor_role)

    table = dynamo.applications()
    try:
        updated = table.update_item(
            Key={"applicationId": application["applicationId"]},
            UpdateExpression=(
                "SET #s = :target, statusHistory = "
                "list_append(if_not_exists(statusHistory, :empty), :entry)"
            ),
            ConditionExpression="#s = :current",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":target": target,
                ":current": current,
                ":empty": [],
                ":entry": [history_entry(target, caller.user_id, note)],
            },
            ReturnValues="ALL_NEW",
        )["Attributes"]
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        raise ApplicationFrozenError(
            "This application changed while your request was being processed. "
            "Reload it and try again."
        )

    # An application that reached a final status has no interview worth showing,
    # so it drops off the company calendar here.
    interview_calendar.apply(
        table, application["applicationId"], updated.get("interviews"), target
    )

    return ok({"application": dynamo.from_dynamo(_status_view(updated))})


# ----------------------------------------------------------------------
# Interviews
# ----------------------------------------------------------------------
@router.route("POST", "/applications/{id}/interview")
def schedule_interview(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-13.1, FR-13.2, FR-13.6 and FR-13.7.

    Each interview is appended rather than written over, so a reschedule leaves
    the earlier entry readable.
    """
    caller = get_caller(event)
    caller.require("Recruiters")
    application = get_application(path_param(event, "id"))
    if application.get("companyId") != caller.user_id:
        raise ForbiddenError("You are not allowed to work with this application.")

    body = parse_body(event)
    interview = _validate_interview(body, caller.user_id)

    current = application.get("status", "")
    if current in FINAL_STATUSES:
        raise ApplicationFrozenError(
            "This application has already reached a final status.",
            {"currentStatus": current},
        )

    table = dynamo.applications()
    updated = table.update_item(
        Key={"applicationId": application["applicationId"]},
        UpdateExpression=(
            "SET interviews = list_append(if_not_exists(interviews, :empty), :interview), "
            "#s = :scheduled, statusHistory = "
            "list_append(if_not_exists(statusHistory, :emptyHistory), :entry)"
        ),
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":empty": [],
            ":emptyHistory": [],
            ":interview": [dynamo.to_dynamo(interview)],
            ":scheduled": INTERVIEW_SCHEDULED,
            ":entry": [
                history_entry(
                    INTERVIEW_SCHEDULED, caller.user_id, "Interview scheduled."
                )
            ],
        },
        ReturnValues="ALL_NEW",
    )["Attributes"]

    # FR-13.8. Puts the application on the company calendar.
    interview_calendar.apply(
        table,
        application["applicationId"],
        updated.get("interviews"),
        updated.get("status", ""),
    )

    # The invitation and its calendar attachment are sent by the notification
    # service off the stream, so this returns without waiting for SES.
    return created({"interview": interview, "status": updated.get("status")})


@router.route("PATCH", "/applications/{id}/interview")
def update_interview(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-13.4 and FR-13.5.

    The applicant confirms or declines. The recruiter reschedules or cancels,
    and a reschedule appends a new entry rather than editing the old one.
    """
    caller = get_caller(event)
    application = get_application(path_param(event, "id"))

    is_recruiter = caller.is_recruiter and application.get("companyId") == caller.user_id
    is_applicant = caller.is_applicant and application.get("applicantId") == caller.user_id
    if not (is_recruiter or is_applicant):
        raise ForbiddenError("You are not allowed to work with this application.")

    interviews: List[Dict[str, Any]] = list(application.get("interviews") or [])
    if not interviews:
        raise NotFoundError("No interview has been scheduled on this application.")

    body = parse_body(event)
    errors = Errors()
    action = require_enum(
        errors, body, "action", {"CONFIRM", "DECLINE", "RESCHEDULE", "CANCEL"}
    )
    errors.raise_if_any()

    if action in ("CONFIRM", "DECLINE") and not is_applicant:
        raise ForbiddenError("Only the applicant can answer an interview invitation.")
    if action in ("RESCHEDULE", "CANCEL") and not is_recruiter:
        raise ForbiddenError("Only the recruiter can reschedule or cancel an interview.")

    index = _latest_open_interview(interviews)
    if index is None:
        raise ApplicationFrozenError(
            "There is no interview on this application still open."
        )

    if action == "RESCHEDULE":
        interviews[index] = {**interviews[index], "state": INTERVIEW_CANCELLED}
        interviews.append(
            _validate_interview(
                body, caller.user_id, sequence=len(interviews), replaces=interviews[index]
            )
        )
    else:
        new_state = {
            "CONFIRM": INTERVIEW_CONFIRMED,
            "DECLINE": INTERVIEW_DECLINED,
            "CANCEL": INTERVIEW_CANCELLED,
        }[action]
        interviews[index] = {
            **interviews[index],
            "state": new_state,
            "respondedAt": now_iso(),
        }

    table = dynamo.applications()
    table.update_item(
        Key={"applicationId": application["applicationId"]},
        UpdateExpression="SET interviews = :interviews, interviewUpdatedAt = :now",
        ExpressionAttributeValues={
            ":interviews": dynamo.to_dynamo(interviews),
            ":now": now_iso(),
        },
    )
    # A cancellation or a decline takes the application off the calendar, and a
    # reschedule moves it. Both are this one call.
    interview_calendar.apply(
        table,
        application["applicationId"],
        interviews,
        application.get("status", ""),
    )
    return ok({"interviews": dynamo.from_dynamo(interviews)})


def _latest_open_interview(interviews: List[Dict[str, Any]]) -> Optional[int]:
    for index in range(len(interviews) - 1, -1, -1):
        if interviews[index].get("state") in (INTERVIEW_PROPOSED, INTERVIEW_CONFIRMED):
            return index
    return None


def _validate_interview(
    body: Dict[str, Any],
    actor_id: str,
    *,
    sequence: int = 0,
    replaces: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    errors = Errors()
    scheduled_at = optional_iso_datetime(errors, body, "scheduledAt")
    if not scheduled_at:
        errors.add("scheduledAt", "Give the date and time of the interview.")
    mode = require_enum(errors, body, "mode", INTERVIEW_MODES)
    duration = optional_int(errors, body, "durationMinutes", minimum=15, maximum=480) or 60
    location = require_string(errors, body, "locationOrLink", max_length=500)
    errors.raise_if_any()

    # FR-13.7
    if is_past(scheduled_at):
        raise ValidationError("An interview cannot be scheduled for a time already past.")

    entry = {
        "interviewId": interview_id(),
        "scheduledAt": scheduled_at,
        "durationMinutes": duration,
        "mode": mode,
        "locationOrLink": location,
        "state": INTERVIEW_PROPOSED,
        "proposedBy": actor_id,
        "proposedAt": now_iso(),
        "sequence": sequence,
    }
    if replaces:
        entry["replacesInterviewId"] = replaces.get("interviewId")
    return entry


# ----------------------------------------------------------------------
# Views
# ----------------------------------------------------------------------
def _document_urls(application: Dict[str, Any]) -> Dict[str, str]:
    urls = {}
    for document_key, s3_key in (application.get("documents") or {}).items():
        try:
            urls[document_key] = storage.presigned_download(s3_key, document_key)
        except Exception:  # noqa: BLE001
            continue
    return urls


def _status_view(application: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "applicationId": application.get("applicationId"),
        "status": application.get("status"),
        "statusHistory": application.get("statusHistory", []),
        "isFinal": application.get("status") in FINAL_STATUSES,
    }


def _applicant_view(
    application: Dict[str, Any], job: Dict[str, Any], *, detailed: bool = False
) -> Dict[str, Any]:
    view = {
        "applicationId": application.get("applicationId"),
        "jobId": application.get("jobId"),
        "jobTitle": job.get("title"),
        "companyName": job.get("companyName"),
        "opportunityType": application.get("opportunityType"),
        "status": application.get("status"),
        "appliedAt": application.get("appliedAt"),
        "lastEditedAt": application.get("lastEditedAt"),
        # FR-5.13. The interface greys out the edit control from this flag
        # rather than deciding for itself what is editable.
        "canEdit": application.get("status") == SUBMITTED,
        "isFinal": application.get("status") in FINAL_STATUSES,
    }
    if detailed:
        view["statusHistory"] = application.get("statusHistory", [])
        view["answers"] = application.get("answers", {})
        view["coverLetter"] = application.get("coverLetter")
        view["interviews"] = application.get("interviews", [])
        view["documentUrls"] = _document_urls(application)
        view["documentRequirements"] = job.get("documentRequirements", [])
    return dynamo.from_dynamo({k: v for k, v in view.items() if v is not None})


def _recruiter_view(application: Dict[str, Any], job: Dict[str, Any]) -> Dict[str, Any]:
    applicant = find_user(application.get("applicantId", ""))
    company = find_company(application.get("companyId", ""))
    view = {
        "applicationId": application.get("applicationId"),
        "jobId": application.get("jobId"),
        "jobTitle": job.get("title"),
        "companyName": company.get("companyName"),
        "applicant": {
            "userId": applicant.get("userId"),
            "fullName": applicant.get("fullName"),
            "email": applicant.get("email"),
            "phone": applicant.get("phone"),
            "skills": applicant.get("skills", []),
            "academicInfo": applicant.get("academicInfo", {}),
        },
        "status": application.get("status"),
        "statusHistory": application.get("statusHistory", []),
        "appliedAt": application.get("appliedAt"),
        # FR-5.15. The recruiter sees when the applicant last touched it.
        "lastEditedAt": application.get("lastEditedAt"),
        "coverLetter": application.get("coverLetter"),
        "answers": application.get("answers", {}),
        "interviews": application.get("interviews", []),
        "parsed": application.get("parsed", {}),
        # The documents exactly as they were submitted, per FR-5.12.
        "documentUrls": _document_urls(application),
    }
    return dynamo.from_dynamo({k: v for k, v in view.items() if v is not None})


lambda_handler = api_handler(router)
