"""Postings, recruiter pipeline views, analytics and export.

Routes
    GET    /jobs                                 public listing with filters
    POST   /jobs                                 create a posting in DRAFT
    GET    /jobs/mine                            the caller's own postings, drafts included
    GET    /jobs/mine/{id}                       one of them in any status, with its company
    GET    /jobs/{id}                            public detail
    PATCH  /jobs/{id}                            edit or change lifecycle status
    GET    /jobs/{id}/applications               the pipeline for one posting
    PATCH  /jobs/{id}/applications/bulk-status   one status change across a selection
    GET    /jobs/{id}/analytics                  funnel for one posting
    GET    /companies/{id}/interviews            the account's interview calendar
    GET    /companies/{id}/applicants            the account's applicants, by person
    GET    /companies/{id}/analytics             aggregate across the account
    POST   /companies/{id}/export                CSV export as a presigned URL
"""
import csv
import io
from typing import Any, Dict, List, Optional

from boto3.dynamodb.conditions import Attr, Key

from common import config, documents, dynamo, storage
from common import interviews as interview_calendar
from common.access import (
    assert_owns_company,
    assert_owns_job,
    find_company,
    find_user,
    get_company,
    get_job,
)
from common.auth import get_caller
from common.errors import ConflictError, ForbiddenError, ValidationError
from common.ids import job_id as new_job_id
from common.responses import created, ok
from common.router import Router, api_handler, parse_body, path_param, query_params
from common.state_machine import (
    ALL_STATUSES,
    FINAL_STATUSES,
    INTERVIEW_SCHEDULED,
    OFFER_ACCEPTED,
    OFFER_DECLINED,
    OFFER_EXTENDED,
    REJECTED,
    SUBMITTED,
    UNDER_REVIEW,
    WITHDRAWN,
    assert_transition,
    funnel_counts,
    history_entry,
)
from common.time_utils import hours_between, is_past, now_iso
from common.validation import (
    EXPERIENCE_LEVELS,
    OPPORTUNITY_TYPES,
    POSTING_STATUSES,
    WORK_MODALITIES,
    Errors,
    optional_enum,
    optional_int,
    optional_iso_datetime,
    optional_string,
    optional_string_list,
    require_enum,
    require_string,
    validate_label_value_pairs,
    validate_salary,
)

router = Router("jobs-service")

DRAFT, PUBLISHED, CLOSED, EXPIRED = "DRAFT", "PUBLISHED", "CLOSED", "EXPIRED"

# FR-4.4. A closed posting can be reopened; an expired one cannot, because its
# deadline has already passed and reopening it would need a new deadline.
POSTING_TRANSITIONS = {
    DRAFT: {PUBLISHED, CLOSED},
    PUBLISHED: {CLOSED},
    CLOSED: {PUBLISHED, DRAFT},
    EXPIRED: {CLOSED},
}


# ----------------------------------------------------------------------
# Postings
# ----------------------------------------------------------------------
@router.route("POST", "/jobs")
def create_job(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-4.1, FR-4.13 and FR-4.15. A posting is always created in DRAFT."""
    caller = get_caller(event)
    caller.require("Recruiters")
    company = get_company(caller.user_id)

    body = parse_body(event)
    errors = Errors()

    title = require_string(errors, body, "title", max_length=200)
    description = require_string(errors, body, "description", max_length=20000)
    opportunity_type = require_enum(errors, body, "opportunityType", OPPORTUNITY_TYPES)
    work_modality = require_enum(errors, body, "workModality", WORK_MODALITIES)
    deadline = optional_iso_datetime(errors, body, "applicationDeadline")
    salary = validate_salary(errors, body)
    extra_details = validate_label_value_pairs(errors, body, "additionalDetails")
    requirements = documents.normalise_requirements(
        errors, body.get("documentRequirements"), opportunity_type or ""
    )
    experience = optional_enum(errors, body, "experienceLevel", EXPERIENCE_LEVELS)
    openings = optional_int(errors, body, "openings", minimum=1, maximum=1000)
    start_date = optional_iso_datetime(errors, body, "startDate")
    errors.raise_if_any()

    if deadline and is_past(deadline):
        raise ValidationError("The application deadline is already in the past.")

    item: Dict[str, Any] = {
        "jobId": new_job_id(),
        "companyId": caller.user_id,
        "companyName": company.get("companyName"),
        "title": title,
        "description": description,
        "opportunityType": opportunity_type,
        "workModality": work_modality,
        "postingStatus": DRAFT,
        "documentRequirements": requirements,
        "createdAt": now_iso(),
    }
    optional_fields = {
        "applicationDeadline": deadline,
        "salary": salary,
        "city": optional_string(body, "city", max_length=120),
        "country": optional_string(body, "country", max_length=120),
        "experienceLevel": experience,
        "openings": openings,
        "startDate": start_date,
        "duration": optional_string(body, "duration", max_length=60),
        "skills": optional_string_list(body, "skills", limit=30),
        "additionalDetails": extra_details,
    }
    item.update({k: v for k, v in optional_fields.items() if v not in (None, [], {})})

    dynamo.jobs().put_item(Item=dynamo.to_dynamo(item))
    return created({"job": _job_view(item, full=True)})


@router.route("PATCH", "/jobs/{id}")
def update_job(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-4.6, FR-4.8 and FR-4.9.

    Publishing is refused while the owning company is not verified, which is the
    gate the whole trust model rests on.
    """
    caller = get_caller(event)
    caller.require("Recruiters", "Admins")
    job = get_job(path_param(event, "id"))
    assert_owns_job(caller, job)

    body = parse_body(event)
    errors = Errors()
    changes: Dict[str, Any] = {}

    if "title" in body:
        changes["title"] = require_string(errors, body, "title", max_length=200)
    if "description" in body:
        changes["description"] = require_string(errors, body, "description", max_length=20000)
    if "workModality" in body:
        changes["workModality"] = require_enum(errors, body, "workModality", WORK_MODALITIES)
    if "applicationDeadline" in body:
        changes["applicationDeadline"] = optional_iso_datetime(
            errors, body, "applicationDeadline"
        )
    if "salary" in body:
        changes["salary"] = validate_salary(errors, body)
    if "additionalDetails" in body:
        changes["additionalDetails"] = validate_label_value_pairs(
            errors, body, "additionalDetails"
        )
    if "documentRequirements" in body:
        changes["documentRequirements"] = documents.normalise_requirements(
            errors, body["documentRequirements"], job.get("opportunityType", "")
        )
    for field, limit in (("city", 120), ("country", 120), ("duration", 60)):
        if field in body:
            changes[field] = optional_string(body, field, max_length=limit)
    if "experienceLevel" in body:
        changes["experienceLevel"] = optional_enum(
            errors, body, "experienceLevel", EXPERIENCE_LEVELS
        )
    if "openings" in body:
        changes["openings"] = optional_int(errors, body, "openings", minimum=1, maximum=1000)
    if "skills" in body:
        changes["skills"] = optional_string_list(body, "skills", limit=30)

    target_status = None
    if "postingStatus" in body:
        target_status = require_enum(errors, body, "postingStatus", POSTING_STATUSES)
    errors.raise_if_any()

    if target_status:
        current = job.get("postingStatus", DRAFT)
        if target_status != current:
            if target_status not in POSTING_TRANSITIONS.get(current, set()):
                raise ConflictError(
                    f"A {current.lower()} posting cannot be set to {target_status.lower()}.",
                    {
                        "currentStatus": current,
                        "allowedNext": sorted(POSTING_TRANSITIONS.get(current, set())),
                    },
                )
            if target_status == PUBLISHED:
                _assert_publishable(job, changes)
            changes["postingStatus"] = target_status

    changes = {k: v for k, v in changes.items() if v is not None}
    if not changes:
        return ok({"job": _job_view(job, full=True)})

    changes["updatedAt"] = now_iso()
    expression, names, values = dynamo.build_update(changes)
    updated = dynamo.jobs().update_item(
        Key={"jobId": job["jobId"]},
        UpdateExpression=expression,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
        ReturnValues="ALL_NEW",
    )["Attributes"]
    return ok({"job": _job_view(updated, full=True)})


def _assert_publishable(job: Dict[str, Any], changes: Dict[str, Any]) -> None:
    company = get_company(job["companyId"])
    if company.get("verificationStatus") != "VERIFIED":
        raise ForbiddenError(
            "This posting cannot be published until the company account is verified."
        )
    deadline = changes.get("applicationDeadline", job.get("applicationDeadline"))
    if deadline and is_past(deadline):
        raise ConflictError("The application deadline has already passed.")


@router.route("GET", "/jobs/{id}")
def get_job_details(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-4.7 and FR-4.10.

    Public route with no authorizer, so the caller is always anonymous here (see
    the note at the end of common/auth.py). The owner reads its own posting
    through GET /jobs/mine/{id}. An applicant who already applied should keep
    access once a posting expires, and that needs an authorizer protected
    counterpart of its own; _has_applied is the check it will use.
    """
    job = get_job(path_param(event, "id"))
    if job.get("postingStatus") != PUBLISHED:
        raise ForbiddenError("This posting is not open.")

    company = find_company(job["companyId"])
    return ok({"job": _job_view(job, full=False), "company": _company_snippet(company, job)})


@router.route("GET", "/jobs/mine")
def list_my_jobs(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """A recruiter's own postings, drafts included.

    This is its own route rather than a query flag on the public listing,
    because GET /jobs carries no Cognito authorizer (it has to work for an
    anonymous applicant browsing postings), and API Gateway never populates
    request context claims on a route with no authorizer attached, no matter
    what a client sends in the Authorization header. A caller here is never
    optional.
    """
    caller = get_caller(event)
    caller.require("Recruiters", "Admins")
    items = dynamo.query_all(
        dynamo.jobs(),
        key_condition=Key("companyId").eq(caller.user_id),
        index_name="CompanyIndex",
        limit=200,
    )
    return ok({"count": len(items), "jobs": [_job_view(j, full=True) for j in items]})


@router.route("GET", "/jobs/mine/{id}")
def get_my_job(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """One of the caller's own postings, in any status.

    The public GET /jobs/{id} serves published postings only and, carrying no
    authorizer, can never tell who is asking. A recruiter editing a draft and an
    admin opening any posting both need the full record, so they read it here
    where the caller is known.

    An admin may read any company's posting; a recruiter only their own. The
    company comes back with it, because every screen that opens a posting this
    way shows whose it is.
    """
    caller = get_caller(event)
    caller.require("Recruiters", "Admins")
    job = get_job(path_param(event, "id"))
    if not caller.is_admin and job.get("companyId") != caller.user_id:
        raise ForbiddenError("That posting belongs to another company.")

    company = find_company(job.get("companyId", ""))
    return ok(
        {
            "job": _job_view(job, full=True),
            "company": dynamo.from_dynamo(
                {
                    "companyId": company.get("companyId"),
                    "companyName": company.get("companyName"),
                    "verificationStatus": company.get("verificationStatus"),
                }
            ),
        }
    )


@router.route("GET", "/jobs")
def list_jobs(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-4.11 and FR-4.12.

    The listing is served by an index query and narrowed by a filter expression.
    Section 4.6 records the point at which a search engine takes this over.
    """
    params = query_params(event)

    opportunity_type = params.get("type")
    if opportunity_type and opportunity_type not in OPPORTUNITY_TYPES:
        raise ValidationError(
            "type must be one of: " + ", ".join(sorted(OPPORTUNITY_TYPES)) + "."
        )

    filters = _listing_filter(params, restrict_published=bool(opportunity_type))

    if opportunity_type:
        items = dynamo.query_all(
            dynamo.jobs(),
            key_condition=Key("opportunityType").eq(opportunity_type),
            index_name="OpportunityTypeIndex",
            filter_expression=filters,
            limit=100,
        )
    else:
        items = dynamo.query_all(
            dynamo.jobs(),
            key_condition=Key("postingStatus").eq(PUBLISHED),
            index_name="PostingStatusIndex",
            filter_expression=filters,
            limit=100,
        )

    keyword = (params.get("q") or "").strip().lower()
    if keyword:
        # Matched against the posting title and the owning company name, which
        # is the pair a person actually searches by.
        items = [
            item
            for item in items
            if keyword in str(item.get("title", "")).lower()
            or keyword in str(item.get("companyName", "")).lower()
        ]

    items = [item for item in items if not _deadline_passed(item)]
    return ok({"count": len(items), "jobs": [_job_view(item, full=False) for item in items]})


def _listing_filter(params: Dict[str, str], *, restrict_published: bool):
    condition = Attr("postingStatus").eq(PUBLISHED) if restrict_published else None

    def combine(existing, addition):
        return addition if existing is None else existing & addition

    if params.get("modality") in WORK_MODALITIES:
        condition = combine(condition, Attr("workModality").eq(params["modality"]))
    if params.get("city"):
        condition = combine(condition, Attr("city").eq(params["city"].strip()))
    if params.get("country"):
        condition = combine(condition, Attr("country").eq(params["country"].strip()))
    if params.get("experience") in EXPERIENCE_LEVELS:
        condition = combine(condition, Attr("experienceLevel").eq(params["experience"]))

    # A salary filter only ever matches a posting that actually disclosed one.
    # Excluding undisclosed postings is the honest reading: the system cannot
    # claim a posting meets a floor it never stated.
    if params.get("salaryMin"):
        try:
            floor = int(params["salaryMin"])
            condition = combine(condition, Attr("salary.max").gte(floor))
        except ValueError:
            raise ValidationError("salaryMin must be a whole number.")
    if params.get("salaryMax"):
        try:
            ceiling = int(params["salaryMax"])
            condition = combine(condition, Attr("salary.min").lte(ceiling))
        except ValueError:
            raise ValidationError("salaryMax must be a whole number.")

    return condition


def _deadline_passed(job: Dict[str, Any]) -> bool:
    return bool(job.get("applicationDeadline")) and is_past(job["applicationDeadline"])


def _has_applied(applicant_id: str, job_id_value: str) -> bool:
    from common.ids import applicant_job_key

    items = dynamo.query_all(
        dynamo.applications(),
        key_condition=Key("applicantJobKey").eq(applicant_job_key(applicant_id, job_id_value)),
        index_name="ApplicantJobIndex",
        limit=1,
    )
    return bool(items)


# ----------------------------------------------------------------------
# Pipeline
# ----------------------------------------------------------------------
@router.route("GET", "/jobs/{id}/applications")
def list_job_applications(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-6.8 and FR-6.9."""
    caller = get_caller(event)
    caller.require("Recruiters", "Admins")
    job = get_job(path_param(event, "id"))
    assert_owns_job(caller, job)

    params = query_params(event)
    status_filter = params.get("status")
    if status_filter and status_filter not in ALL_STATUSES:
        raise ValidationError("status is not one this system recognises.")

    items = dynamo.query_all(
        dynamo.applications(),
        key_condition=Key("jobId").eq(job["jobId"]),
        index_name="JobIndex",
        limit=500,
    )
    if status_filter:
        items = [item for item in items if item.get("status") == status_filter]

    # One batch for the whole board rather than a read per card. A busy posting
    # is exactly where the per-row lookup was worst.
    people = dynamo.get_users(item.get("applicantId", "") for item in items)

    return ok(
        {
            "job": {"jobId": job["jobId"], "title": job.get("title")},
            "count": len(items),
            "applications": [
                _pipeline_row(item, people.get(item.get("applicantId", ""), {}))
                for item in items
            ],
        }
    )


@router.route("PATCH", "/jobs/{id}/applications/bulk-status")
def bulk_status(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-14.1 to FR-14.4.

    Each application is checked and written on its own, so one refusal does not
    stop the rest. The response reports every outcome rather than a single
    success or failure, which is what makes the result usable in the interface.
    """
    caller = get_caller(event)
    caller.require("Recruiters")
    job = get_job(path_param(event, "id"))
    assert_owns_job(caller, job)

    body = parse_body(event)
    errors = Errors()
    target = require_enum(errors, body, "status", ALL_STATUSES)
    note = optional_string(body, "note", max_length=500) or ""
    ids = body.get("applicationIds")
    if not isinstance(ids, list) or not ids:
        errors.add("applicationIds", "Select at least one application.")
    elif len(ids) > config.BULK_ACTION_LIMIT:
        errors.add(
            "applicationIds",
            f"At most {config.BULK_ACTION_LIMIT} applications can be changed at once.",
        )
    errors.raise_if_any()

    updated: List[str] = []
    refused: List[Dict[str, str]] = []
    table = dynamo.applications()

    for application_id in ids:
        record = table.get_item(Key={"applicationId": application_id}).get("Item")
        if not record or record.get("jobId") != job["jobId"]:
            refused.append({"applicationId": application_id, "reason": "Not found on this posting."})
            continue
        current = record.get("status", "")
        if target == INTERVIEW_SCHEDULED:
            # An interview is a time and a place, booked through
            # POST /applications/{id}/interview. A status alone would put the
            # card in the interview column with nothing on the calendar.
            refused.append(
                {
                    "applicationId": application_id,
                    "reason": "Interviews are booked one at a time, each with its own time.",
                }
            )
            continue
        try:
            assert_transition(current, target, "RECRUITER")
        except ConflictError as exc:
            refused.append({"applicationId": application_id, "reason": exc.message})
            continue
        try:
            table.update_item(
                Key={"applicationId": application_id},
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
            )
            updated.append(application_id)
            # A bulk rejection has to take those applications off the company
            # calendar just as a single one does.
            interview_calendar.apply(
                table, application_id, record.get("interviews"), target
            )
        except table.meta.client.exceptions.ConditionalCheckFailedException:
            refused.append(
                {
                    "applicationId": application_id,
                    "reason": "Its status changed while the request was being processed.",
                }
            )

    # Notifications follow from the stream, so this returns without waiting for
    # any email to be delivered, which is FR-14.3.
    return ok({"updated": updated, "refused": refused, "status": target})


# ----------------------------------------------------------------------
# Analytics
# ----------------------------------------------------------------------
@router.route("GET", "/companies/{id}/interviews")
def company_interviews(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-13.8. The company's interview calendar.

    One ranged query on CompanyInterviewIndex, already in time order because the
    interview time is the sort key. The window ends a fortnight out, which is
    what a calendar opens on, and from and to move it for a day, a week or a
    month view without any change here.

    It has no lower bound unless one is asked for, and that is deliberate. An
    application carries nextInterviewAt until something writes to it, and the
    clock passing an interview writes nothing, so an interview nobody recorded
    an outcome for keeps a timestamp in the past forever. A window starting at
    now dropped exactly those, which left the account counting an application at
    INTERVIEW_SCHEDULED while the calendar showed nothing at all and no screen
    said where it went. They are the rows most in need of a recruiter, so they
    come back separately rather than being mixed into the days ahead.
    """
    caller = get_caller(event)
    caller.require("Recruiters", "Admins")
    company_id = path_param(event, "id")
    assert_owns_company(caller, company_id)

    params = query_params(event)
    moment = now_iso()
    window_from = params.get("from")
    window_to = params.get("to") or _plus_days(window_from or moment, 14)
    if window_from and window_to < window_from:
        raise ValidationError("The end of the window is before its start.")

    key = Key("companyId").eq(company_id)
    key = key & (
        Key("nextInterviewAt").between(window_from, window_to)
        if window_from
        else Key("nextInterviewAt").lte(window_to)
    )
    rows = dynamo.query_all(
        dynamo.applications(),
        key_condition=key,
        index_name="CompanyInterviewIndex",
        scan_forward=True,
        limit=500,
    )

    job_cache: Dict[str, Dict[str, Any]] = {}
    entries: List[Dict[str, Any]] = []
    for row in rows:
        job_id_value = row.get("jobId", "")
        if job_id_value not in job_cache:
            job_cache[job_id_value] = (
                dynamo.jobs().get_item(Key={"jobId": job_id_value}).get("Item") or {}
            )
        posting = job_cache[job_id_value]
        applicant = find_user(row.get("applicantId", ""))
        interview = row.get("nextInterview") or {}
        entries.append(
            {
                "applicationId": row.get("applicationId"),
                "jobId": job_id_value,
                "jobTitle": posting.get("title"),
                "applicantName": applicant.get("fullName"),
                "applicantEmail": applicant.get("email"),
                "applicationStatus": row.get("status"),
                "scheduledAt": interview.get("scheduledAt"),
                "durationMinutes": interview.get("durationMinutes"),
                "mode": interview.get("mode"),
                "locationOrLink": interview.get("locationOrLink"),
                "interviewState": interview.get("state"),
                "round": int(interview.get("round") or 1),
                "roundLabel": interview.get("roundLabel"),
            }
        )

    # Split on the clock rather than on anything stored, so a row moves from one
    # side to the other by itself as its time passes.
    ahead = [e for e in entries if str(e.get("scheduledAt") or "") >= moment]
    passed = [e for e in entries if str(e.get("scheduledAt") or "") < moment]
    # Most overdue last, so the list reads oldest first the way a backlog does.
    passed.sort(key=lambda entry: str(entry.get("scheduledAt") or ""))

    return ok(
        {
            "from": window_from or moment,
            "to": window_to,
            "count": len(ahead),
            "interviews": dynamo.from_dynamo(ahead),
            # Interviews that have happened with nothing recorded since. Not a
            # calendar entry any more: a job of work.
            "awaitingOutcome": dynamo.from_dynamo(passed),
        }
    )


def _plus_days(moment: str, days: int) -> str:
    from datetime import timedelta

    from common.time_utils import now, parse_iso

    start = parse_iso(moment) or now()
    return (start + timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


@router.route("GET", "/jobs/{id}/analytics")
def job_analytics(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-10.1, FR-10.3 and FR-10.4. Computed on read from statusHistory."""
    caller = get_caller(event)
    caller.require("Recruiters", "Admins")
    job = get_job(path_param(event, "id"))
    assert_owns_job(caller, job)

    applications = dynamo.query_all(
        dynamo.applications(),
        key_condition=Key("jobId").eq(job["jobId"]),
        index_name="JobIndex",
        limit=1000,
    )
    counts = funnel_counts([a.get("status", "") for a in applications])
    offers = counts["OFFER_EXTENDED"] + counts["OFFER_ACCEPTED"] + counts["OFFER_DECLINED"]
    total = len(applications)

    return ok(
        {
            "jobId": job["jobId"],
            "title": job.get("title"),
            "totalApplications": total,
            "funnel": counts,
            "applicantsPerOffer": round(total / offers, 2) if offers else None,
            "averageHoursInStage": _average_time_in_stage(applications),
        }
    )


@router.route("GET", "/companies/{id}/applicants")
def company_applicants(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """The account's applicants, one row per person rather than per application.

    Every other recruiter view is organised by posting, which means somebody who
    applied to three of your openings reads as three unrelated cards on three
    boards. This route is the one place the same person is one person: their
    applications are gathered under them, with the furthest stage any of them
    reached and what is waiting on each side.

    Assembled the same way company_analytics is, by querying JobIndex once per
    posting, for the reason section 4.6 records. The profiles are then read in
    batches rather than one per row, because the interesting case for this page
    is the account with many applicants and that is exactly the case where one
    GetItem per person stops being acceptable.
    """
    caller = get_caller(event)
    caller.require("Recruiters", "Admins")
    company_id = path_param(event, "id")
    assert_owns_company(caller, company_id)

    postings = dynamo.query_all(
        dynamo.jobs(),
        key_condition=Key("companyId").eq(company_id),
        index_name="CompanyIndex",
        limit=300,
    )
    titles = {posting["jobId"]: posting.get("title") for posting in postings}

    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for posting in postings:
        for application in dynamo.query_all(
            dynamo.applications(),
            key_condition=Key("jobId").eq(posting["jobId"]),
            index_name="JobIndex",
            limit=1000,
        ):
            grouped.setdefault(application.get("applicantId", ""), []).append(application)
    grouped.pop("", None)

    profiles = dynamo.get_users(grouped.keys())
    rows = [
        _applicant_row(applicant_id, applications, profiles.get(applicant_id, {}), titles)
        for applicant_id, applications in grouped.items()
    ]
    # Most recently active first, which is the order a recruiter reads this in.
    rows.sort(key=lambda row: row["lastActivityAt"] or "", reverse=True)

    return ok({"companyId": company_id, "applicants": rows})


@router.route("GET", "/companies/{id}/analytics")
def company_analytics(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-10.2 and FR-10.5.

    The account view is assembled by querying JobIndex once per posting. Section
    4.6 records why a dedicated index is not added for this yet.
    """
    caller = get_caller(event)
    caller.require("Recruiters", "Admins")
    company_id = path_param(event, "id")
    assert_owns_company(caller, company_id)

    postings = dynamo.query_all(
        dynamo.jobs(),
        key_condition=Key("companyId").eq(company_id),
        index_name="CompanyIndex",
        limit=300,
    )

    all_applications: List[Dict[str, Any]] = []
    per_posting: List[Dict[str, Any]] = []
    for posting in postings:
        rows = dynamo.query_all(
            dynamo.applications(),
            key_condition=Key("jobId").eq(posting["jobId"]),
            index_name="JobIndex",
            limit=1000,
        )
        all_applications.extend(rows)
        per_posting.append(
            {
                "jobId": posting["jobId"],
                "title": posting.get("title"),
                "postingStatus": posting.get("postingStatus"),
                "applications": len(rows),
            }
        )

    counts = funnel_counts([a.get("status", "") for a in all_applications])
    decided = counts["OFFER_ACCEPTED"] + counts["OFFER_DECLINED"]
    by_type: Dict[str, int] = {}
    for application in all_applications:
        key = application.get("opportunityType", "UNKNOWN")
        by_type[key] = by_type.get(key, 0) + 1

    return ok(
        {
            "companyId": company_id,
            "postings": len(postings),
            "totalApplications": len(all_applications),
            "funnel": counts,
            "offerAcceptanceRate": (
                round(counts["OFFER_ACCEPTED"] / decided, 3) if decided else None
            ),
            "byOpportunityType": by_type,
            "perPosting": per_posting,
        }
    )


def _average_time_in_stage(applications: List[Dict[str, Any]]) -> Dict[str, float]:
    """Time in stage derived from statusHistory rather than from a separate store."""
    totals: Dict[str, List[float]] = {}
    for application in applications:
        history = application.get("statusHistory") or []
        for index in range(len(history) - 1):
            status = history[index].get("status")
            hours = hours_between(
                history[index].get("timestamp"), history[index + 1].get("timestamp")
            )
            if status and hours is not None:
                totals.setdefault(status, []).append(hours)
    return {
        status: round(sum(values) / len(values), 2)
        for status, values in totals.items()
        if values
    }


# ----------------------------------------------------------------------
# Export
# ----------------------------------------------------------------------
@router.route("POST", "/companies/{id}/export")
def export_applications(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-14.5 to FR-14.7.

    The CSV is written to the documents bucket and returned as a presigned URL
    rather than as a response body, which keeps it clear of the Lambda response
    size limit. Documents themselves are never included.
    """
    caller = get_caller(event)
    caller.require("Recruiters", "Admins")
    company_id = path_param(event, "id")
    assert_owns_company(caller, company_id)

    body = parse_body(event)
    single_job = optional_string(body, "jobId", max_length=80)

    postings = dynamo.query_all(
        dynamo.jobs(),
        key_condition=Key("companyId").eq(company_id),
        index_name="CompanyIndex",
        limit=300,
    )
    if single_job:
        postings = [p for p in postings if p["jobId"] == single_job]
        if not postings:
            raise ForbiddenError("That posting does not belong to this account.")

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "jobId",
            "postingTitle",
            "opportunityType",
            "applicationId",
            "applicantName",
            "applicantEmail",
            "currentStatus",
            "appliedAt",
            "lastEditedAt",
            "statusHistory",
        ]
    )

    rows = 0
    name_cache: Dict[str, Dict[str, Any]] = {}
    for posting in postings:
        applications = dynamo.query_all(
            dynamo.applications(),
            key_condition=Key("jobId").eq(posting["jobId"]),
            index_name="JobIndex",
            limit=1000,
        )
        for application in applications:
            applicant_id = application.get("applicantId", "")
            if applicant_id not in name_cache:
                name_cache[applicant_id] = find_user(applicant_id)
            applicant = name_cache[applicant_id]
            history = " | ".join(
                f"{entry.get('status')}@{entry.get('timestamp')}"
                for entry in application.get("statusHistory") or []
            )
            writer.writerow(
                [
                    posting["jobId"],
                    posting.get("title", ""),
                    posting.get("opportunityType", ""),
                    application.get("applicationId", ""),
                    applicant.get("fullName", ""),
                    applicant.get("email", ""),
                    application.get("status", ""),
                    application.get("appliedAt", ""),
                    application.get("lastEditedAt", ""),
                    history,
                ]
            )
            rows += 1

    key = storage.build_key(
        company_id, "export", f"applications-{now_iso().replace(':', '-')}.csv"
    )
    storage.put_object(key, buffer.getvalue().encode("utf-8"), "text/csv")

    return created(
        {
            "rows": rows,
            "downloadUrl": storage.presigned_download(key, "applications.csv"),
            "expiresInSeconds": config.PRESIGNED_DOWNLOAD_TTL_SECONDS,
        }
    )


# ----------------------------------------------------------------------
# Views
# ----------------------------------------------------------------------
def _job_view(job: Dict[str, Any], *, full: bool) -> Dict[str, Any]:
    view = dict(job)
    if not full:
        view.pop("unpublishedAt", None)
    view["isOpen"] = job.get("postingStatus") == PUBLISHED and not _deadline_passed(job)
    return dynamo.from_dynamo(view)


def _company_snippet(company: Dict[str, Any], job: Dict[str, Any]) -> Dict[str, Any]:
    """FR-4.3. Read from the Companies table at display time, never copied.

    A company that corrects its website should not leave stale links on every
    posting it has ever created.
    """
    snippet = {
        "companyId": company.get("companyId"),
        "companyName": company.get("companyName"),
        "verificationStatus": company.get("verificationStatus"),
    }
    if job.get("workModality") in ("ONSITE", "HYBRID"):
        snippet["companyWebsiteUrl"] = company.get("companyWebsiteUrl")
        snippet["googleMapsUrl"] = company.get("googleMapsUrl")
        snippet["officeAddress"] = company.get("officeAddress")
    else:
        snippet["companyWebsiteUrl"] = company.get("companyWebsiteUrl")
    return {k: v for k, v in snippet.items() if v is not None}


# The order the pipeline actually runs in, used to answer how far somebody got
# across several applications. The three endings sit below the run rather than
# inside it: a rejection is not further along than an interview, so they rank
# under every live stage and only ever win when nothing live exists.
_PROGRESS = [
    SUBMITTED,
    UNDER_REVIEW,
    INTERVIEW_SCHEDULED,
    OFFER_EXTENDED,
    OFFER_ACCEPTED,
]


def _furthest(statuses: List[str]) -> str:
    live = [s for s in statuses if s in _PROGRESS]
    if live:
        return max(live, key=_PROGRESS.index)
    # Nothing live: report what actually happened, preferring the ending the
    # applicant chose over the one the company did, since "they turned us down"
    # is the more useful thing to know when both appear.
    for ending in (OFFER_DECLINED, WITHDRAWN, REJECTED):
        if ending in statuses:
            return ending
    return statuses[0] if statuses else SUBMITTED


def _status_changed_at(application: Dict[str, Any]) -> Optional[str]:
    """When the application last moved, which is what time in stage counts from.

    Read off the end of statusHistory rather than stored, because the history is
    already the record of every move and a second copy of the last one would be
    a second thing to keep in step. Falls back to the application's own
    timestamp, so a row written before any history existed still reads.
    """
    history = application.get("statusHistory") or []
    if history:
        last = history[-1].get("timestamp")
        if last:
            return str(last)
    return application.get("appliedAt")


def _pipeline_row(application: Dict[str, Any], applicant: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """One card on a board.

    The applicant is passed in where the caller has already read a batch of
    them, and looked up here otherwise, so a single application costs one read
    and a page of fifty costs one batch.
    """
    person = applicant if applicant is not None else find_user(application.get("applicantId", ""))
    return dynamo.from_dynamo(
        {
            "applicationId": application.get("applicationId"),
            "applicantId": application.get("applicantId"),
            "applicantName": person.get("fullName"),
            "applicantEmail": person.get("email"),
            "status": application.get("status"),
            "appliedAt": application.get("appliedAt"),
            "statusChangedAt": _status_changed_at(application),
            "lastEditedAt": application.get("lastEditedAt"),
            "isFinal": application.get("status") in FINAL_STATUSES,
            "interviewCount": len(application.get("interviews") or []),
            "nextInterview": application.get(interview_calendar.SNAPSHOT_FIELD),
            # How far through its interview rounds the application is, so a
            # card between rounds can say so rather than showing nothing.
            "roundsCompleted": sum(
                1
                for interview in application.get("interviews") or []
                if interview.get("state") == "COMPLETED"
            ),
        }
    )


def _applicant_row(
    applicant_id: str,
    applications: List[Dict[str, Any]],
    profile: Dict[str, Any],
    titles: Dict[str, Optional[str]],
) -> Dict[str, Any]:
    """One person, with everything they have sent this company under them."""
    ordered = sorted(applications, key=lambda a: str(a.get("appliedAt") or ""))
    statuses = [str(a.get("status") or "") for a in ordered]
    moments = [_status_changed_at(a) for a in ordered]

    # Open interview invitations across all of them, which is the other half of
    # what is waiting on the applicant alongside an offer they have not answered.
    awaiting_interview = sum(
        1
        for application in ordered
        for interview in (application.get("interviews") or [])
        if interview.get("state") == "PROPOSED"
    )

    return dynamo.from_dynamo(
        {
            "applicantId": applicant_id,
            "fullName": profile.get("fullName"),
            "email": profile.get("email"),
            "phone": profile.get("phone"),
            "skills": profile.get("skills") or [],
            "academicInfo": profile.get("academicInfo"),
            "applicationCount": len(ordered),
            "firstAppliedAt": ordered[0].get("appliedAt") if ordered else None,
            "lastActivityAt": max([m for m in moments if m], default=None),
            "furthestStatus": _furthest(statuses),
            # Whether this person is still in play anywhere, which is what
            # separates somebody to act on from somebody already dealt with.
            "isActive": any(s not in FINAL_STATUSES for s in statuses),
            "awaitingReview": sum(1 for s in statuses if s == SUBMITTED),
            "awaitingTheirReply": sum(1 for s in statuses if s == OFFER_EXTENDED)
            + awaiting_interview,
            "applications": [
                {
                    "applicationId": application.get("applicationId"),
                    "jobId": application.get("jobId"),
                    "jobTitle": titles.get(str(application.get("jobId"))),
                    "status": application.get("status"),
                    "appliedAt": application.get("appliedAt"),
                    "statusChangedAt": _status_changed_at(application),
                    "isFinal": application.get("status") in FINAL_STATUSES,
                    "interviewCount": len(application.get("interviews") or []),
                    "nextInterview": application.get(interview_calendar.SNAPSHOT_FIELD),
                }
                for application in reversed(ordered)
            ],
        }
    )


lambda_handler = api_handler(router)
