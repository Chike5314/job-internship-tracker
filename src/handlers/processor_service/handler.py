"""Background work.

Two triggers arrive here.

A message on the submission queue means a new application was accepted. The
processor parses the documents attached to it, records what it found, alerts the
owning recruiter account through SNS and sends the applicant a confirmation. A
message that fails three times lands in the dead letter queue where it can be
inspected, so the applicant never loses a submission over a processing fault.

A scheduled event means the hourly sweep for postings whose deadline has passed.
"""
import json
import logging
from typing import Any, Dict, List

from boto3.dynamodb.conditions import Attr, Key

from common import alerts, dynamo, email, notifications
from common.access import find_company, find_user
from common.parsing import parse_documents
from common.time_utils import is_past, now_iso

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    if event.get("task") == "EXPIRE_POSTINGS":
        return expire_postings()
    if "Records" in event:
        return handle_queue(event)
    logger.warning("processor received an event it does not handle")
    return {"handled": False}


# ----------------------------------------------------------------------
# Submission processing
# ----------------------------------------------------------------------
def handle_queue(event: Dict[str, Any]) -> Dict[str, Any]:
    failures: List[Dict[str, str]] = []
    for record in event.get("Records", []):
        message_id = record.get("messageId", "")
        try:
            body = json.loads(record.get("body") or "{}")
            if body.get("type") == "APPLICATION_SUBMITTED":
                process_submission(body["applicationId"])
            else:
                logger.info("ignoring message type %s", body.get("type"))
        except Exception:  # noqa: BLE001
            logger.exception("submission message %s failed", message_id)
            failures.append({"itemIdentifier": message_id})
    return {"batchItemFailures": failures}


def process_submission(application_id: str) -> None:
    application = (
        dynamo.applications().get_item(Key={"applicationId": application_id}).get("Item")
    )
    if not application:
        logger.warning("application %s no longer exists", application_id)
        return

    job = dynamo.jobs().get_item(Key={"jobId": application.get("jobId", "")}).get("Item") or {}
    applicant = find_user(application.get("applicantId", ""))
    company = find_company(application.get("companyId", ""))

    parsed = parse_documents(application.get("documents") or {})
    if parsed:
        dynamo.applications().update_item(
            Key={"applicationId": application_id},
            UpdateExpression="SET parsed = :parsed, processedAt = :now",
            ExpressionAttributeValues={
                ":parsed": dynamo.to_dynamo(parsed),
                ":now": now_iso(),
            },
        )

    _alert_recruiter(application, applicant, company, job)
    _confirm_to_applicant(application, applicant, company, job)


def _alert_recruiter(
    application: Dict[str, Any],
    applicant: Dict[str, Any],
    company: Dict[str, Any],
    job: Dict[str, Any],
) -> None:
    """FR-8.2 and FR-12.1.

    The recruiter learns about a new application without having to watch the
    dashboard, and the same event is recorded in the notification centre.
    """
    title = job.get("title", "a posting")
    message = (
        f"{applicant.get('fullName', 'An applicant')} applied to {title}. "
        f"Open the posting to review the application."
    )

    notifications.record(
        application.get("companyId", ""),
        notifications.NEW_APPLICATION,
        message,
        f"/postings/{application.get('jobId')}",
    )

    # SNS is the recruiter channel and SES is the applicant channel. Sending the
    # same alert down both would reach the recruiter twice, so the recruiter gets
    # it once here and the notification centre record above holds it either way.
    alerts.notify_company(
        application.get("companyId", ""), f"New application: {title}", message
    )


def _confirm_to_applicant(
    application: Dict[str, Any],
    applicant: Dict[str, Any],
    company: Dict[str, Any],
    job: Dict[str, Any],
) -> None:
    title = job.get("title", "the posting")
    company_name = company.get("companyName", "the company")
    email.send(
        applicant.get("email", ""),
        f"We received your application to {title}",
        (
            f"Your application to {title} at {company_name} was received and is "
            f"waiting for review.\n\nYou can still change the documents and the "
            f"free text on it until a recruiter opens it."
        ),
    )


# ----------------------------------------------------------------------
# Scheduled expiry
# ----------------------------------------------------------------------
def expire_postings() -> Dict[str, Any]:
    """FR-4.5.

    Only published postings are considered, and only those that actually carry a
    deadline, which keeps the hourly sweep to a single index query.
    """
    postings = dynamo.query_all(
        dynamo.jobs(),
        key_condition=Key("postingStatus").eq("PUBLISHED"),
        index_name="PostingStatusIndex",
        filter_expression=Attr("applicationDeadline").exists(),
        limit=1000,
        page_cap=50,
    )

    expired = 0
    for posting in postings:
        if not is_past(posting.get("applicationDeadline")):
            continue
        try:
            dynamo.jobs().update_item(
                Key={"jobId": posting["jobId"]},
                UpdateExpression="SET postingStatus = :expired, expiredAt = :now",
                ConditionExpression="postingStatus = :published",
                ExpressionAttributeValues={
                    ":expired": "EXPIRED",
                    ":published": "PUBLISHED",
                    ":now": now_iso(),
                },
            )
            expired += 1
            notifications.record(
                posting.get("companyId", ""),
                notifications.STATUS_CHANGE,
                f"Your posting {posting.get('title', '')} reached its deadline and is "
                f"no longer accepting applications.",
                f"/postings/{posting['jobId']}",
            )
        except Exception:  # noqa: BLE001
            logger.exception("posting %s could not be expired", posting.get("jobId"))

    logger.info("expiry sweep checked %s postings and expired %s", len(postings), expired)
    return {"checked": len(postings), "expired": expired}
