"""The notification centre, and the stream consumer that feeds it.

This function has two jobs and picks between them from the shape of the event.

As an API it serves
    GET    /notifications
    PATCH  /notifications/{id}/read
    PATCH  /notifications/read-all

As a stream consumer it reads the Applications table stream and, for every
status change and every interview, writes a notification record and sends the
matching email. Driving this from the stream rather than from the request is
what makes FR-8.6 hold: an email that cannot be delivered has no way to undo a
status change that is already written.
"""
import logging
from typing import Any, Dict, List, Optional

from boto3.dynamodb.conditions import Key
from boto3.dynamodb.types import TypeDeserializer

from common import alerts, dynamo, email, notifications
from common.access import find_company, find_user
from common.auth import get_caller
from common.errors import NotFoundError
from common.responses import ok
from common.router import Router, api_handler, path_param, query_params
from common.state_machine import INTERVIEW_SCHEDULED
from common.time_utils import now_iso

logger = logging.getLogger()
logger.setLevel(logging.INFO)

router = Router("notification-service")
_deserializer = TypeDeserializer()

STATUS_WORDING = {
    "SUBMITTED": "Your application has been received.",
    "UNDER_REVIEW": "A recruiter has started reviewing your application.",
    "INTERVIEW_SCHEDULED": "You have been invited to an interview.",
    "OFFER_EXTENDED": "You have received an offer.",
    "OFFER_ACCEPTED": "You accepted the offer.",
    "OFFER_DECLINED": "You declined the offer.",
    "REJECTED": "Your application was not taken forward.",
    "WITHDRAWN": "You withdrew your application.",
}


# ----------------------------------------------------------------------
# Notification centre
# ----------------------------------------------------------------------
@router.route("GET", "/notifications")
def list_notifications(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """FR-12.2 and FR-12.5. One query on the partition key, newest first."""
    caller = get_caller(event)
    params = query_params(event)

    items = dynamo.query_all(
        dynamo.notifications(),
        key_condition=Key("userId").eq(caller.user_id),
        scan_forward=False,
        limit=100,
    )
    unread = sum(1 for item in items if not item.get("read"))
    if params.get("unread") == "true":
        items = [item for item in items if not item.get("read")]

    return ok(
        {
            "unreadCount": unread,
            "count": len(items),
            "notifications": dynamo.from_dynamo(items),
        }
    )


@router.route("PATCH", "/notifications/{id}/read")
def mark_one_read(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    caller = get_caller(event)
    notification_id = path_param(event, "id")

    items = dynamo.query_all(
        dynamo.notifications(),
        key_condition=Key("userId").eq(caller.user_id),
        scan_forward=False,
        limit=200,
    )
    target = next(
        (item for item in items if item.get("notificationId") == notification_id), None
    )
    if target is None:
        raise NotFoundError("We could not find that notification.")

    dynamo.notifications().update_item(
        Key={"userId": caller.user_id, "createdAt": target["createdAt"]},
        UpdateExpression="SET #r = :true, readAt = :now",
        ExpressionAttributeNames={"#r": "read"},
        ExpressionAttributeValues={":true": True, ":now": now_iso()},
    )
    return ok({"notificationId": notification_id, "read": True})


@router.route("PATCH", "/notifications/read-all")
def mark_all_read(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    caller = get_caller(event)
    items = dynamo.query_all(
        dynamo.notifications(),
        key_condition=Key("userId").eq(caller.user_id),
        scan_forward=False,
        limit=500,
    )
    table = dynamo.notifications()
    changed = 0
    for item in items:
        if item.get("read"):
            continue
        table.update_item(
            Key={"userId": caller.user_id, "createdAt": item["createdAt"]},
            UpdateExpression="SET #r = :true, readAt = :now",
            ExpressionAttributeNames={"#r": "read"},
            ExpressionAttributeValues={":true": True, ":now": now_iso()},
        )
        changed += 1
    return ok({"marked": changed, "unreadCount": 0})


_api = api_handler(router)


# ----------------------------------------------------------------------
# Stream consumer
# ----------------------------------------------------------------------
def _plain(image: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not image:
        return {}
    return {key: _deserializer.deserialize(value) for key, value in image.items()}


def handle_stream(event: Dict[str, Any]) -> Dict[str, Any]:
    """Reports per item failures so one bad record does not replay the batch."""
    failures: List[Dict[str, str]] = []

    for record in event.get("Records", []):
        try:
            _handle_record(record)
        except Exception:  # noqa: BLE001
            logger.exception("stream record failed")
            failures.append({"itemIdentifier": record.get("eventID", "")})

    return {"batchItemFailures": failures}


def _handle_record(record: Dict[str, Any]) -> None:
    event_name = record.get("eventName")
    if event_name not in ("INSERT", "MODIFY"):
        return

    image = record.get("dynamodb", {})
    new_item = _plain(image.get("NewImage"))
    old_item = _plain(image.get("OldImage"))
    if not new_item:
        return

    new_status = new_item.get("status")
    old_status = old_item.get("status")

    interviews_grew = len(new_item.get("interviews") or []) > len(
        old_item.get("interviews") or []
    )

    if new_status == old_status and not interviews_grew:
        return

    applicant = find_user(new_item.get("applicantId", ""))
    company = find_company(new_item.get("companyId", ""))
    job = dynamo.jobs().get_item(Key={"jobId": new_item.get("jobId", "")}).get("Item") or {}

    if interviews_grew and new_status == INTERVIEW_SCHEDULED:
        _send_interview_invitation(new_item, applicant, company, job)
        return

    if new_status and new_status != old_status:
        _announce_status(new_item, new_status, applicant, company, job)


def _announce_status(
    application: Dict[str, Any],
    status: str,
    applicant: Dict[str, Any],
    company: Dict[str, Any],
    job: Dict[str, Any],
) -> None:
    """FR-8.1, FR-8.5 and FR-12.1.

    The email carries the posting title, the company name and the new status,
    and the notification record is written whether or not the email lands.
    """
    title = job.get("title", "a posting")
    company_name = company.get("companyName", "the company")
    wording = STATUS_WORDING.get(status, f"Your application status is now {status}.")
    message = f"{wording} Posting: {title} at {company_name}."

    notifications.record(
        application.get("applicantId", ""),
        notifications.STATUS_CHANGE,
        message,
        f"/applications/{application.get('applicationId')}",
    )
    email.send(
        applicant.get("email", ""),
        f"Update on your application to {title}",
        f"{message}\n\nYou can see the full history in your dashboard.",
    )

    # FR-8.2 is served by the processor off the queue for a new submission. A
    # later status the applicant themselves set is the one the recruiter wants
    # to hear about here.
    if status in ("OFFER_ACCEPTED", "OFFER_DECLINED", "WITHDRAWN"):
        recruiter_message = (
            f"{applicant.get('fullName', 'An applicant')} "
            f"{status.replace('_', ' ').lower()} on {title}."
        )
        notifications.record(
            application.get("companyId", ""),
            notifications.STATUS_CHANGE,
            recruiter_message,
            f"/postings/{application.get('jobId')}",
        )
        alerts.notify_company(
            application.get("companyId", ""),
            f"Applicant update on {title}",
            recruiter_message,
        )


def _send_interview_invitation(
    application: Dict[str, Any],
    applicant: Dict[str, Any],
    company: Dict[str, Any],
    job: Dict[str, Any],
) -> None:
    """FR-13.3. An iCalendar attachment both parties can add to any calendar."""
    interviews = application.get("interviews") or []
    if not interviews:
        return
    interview = interviews[-1]

    title = job.get("title", "a posting")
    company_name = company.get("companyName", "the company")
    when = interview.get("scheduledAt")
    where = interview.get("locationOrLink", "")
    mode = interview.get("mode", "ONLINE")

    message = (
        f"An interview for {title} at {company_name} is scheduled for {when}. "
        f"{'Joining link' if mode == 'ONLINE' else 'Address'}: {where}"
    )

    notifications.record(
        application.get("applicantId", ""),
        notifications.INTERVIEW,
        message,
        f"/applications/{application.get('applicationId')}",
    )

    try:
        ics = email.build_ics(
            uid=interview.get("interviewId"),
            summary=f"Interview: {title} at {company_name}",
            description=message,
            starts_at=when,
            duration_minutes=int(interview.get("durationMinutes", 60)),
            location=where,
            organiser_email=company.get("contactEmail", ""),
            attendee_emails=[applicant.get("email", ""), company.get("contactEmail", "")],
            sequence=int(interview.get("sequence", 0)),
        )
    except ValueError:
        logger.warning("interview had no usable start time, sending plain email instead")
        email.send(applicant.get("email", ""), f"Interview for {title}", message)
        return

    email.send_with_calendar(
        [applicant.get("email", ""), company.get("contactEmail", "")],
        f"Interview for {title} at {company_name}",
        message,
        ics,
    )


# ----------------------------------------------------------------------
# Entry point
# ----------------------------------------------------------------------
def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    if "Records" in event:
        return handle_stream(event)
    return _api(event, context)
