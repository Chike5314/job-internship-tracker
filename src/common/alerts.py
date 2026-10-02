"""Recruiter alerts through SNS.

FR-8.2. A recruiter should not have to watch a dashboard to learn that an
application arrived, so the alert is pushed rather than polled.

One topic serves every company, and each company's subscription carries a filter
policy on its own companyId. That is the reason every publish here sets companyId
as a message attribute: without it the message matches no filter policy and
reaches nobody. A topic per company would also work and would need no filtering,
but it would mean one AWS resource per account on the platform, created outside
the CDK stack and never cleaned up.

Publishing never raises into the caller. The notification record and the database
write have already happened by the time this runs, and losing either over a
messaging fault would be the worse outcome. This is the same reasoning as
FR-8.6.
"""
import functools
import logging
from typing import Optional

import boto3

from common import config

logger = logging.getLogger(__name__)


@functools.lru_cache(maxsize=1)
def _sns():
    return boto3.client("sns")


def notify_company(company_id: str, subject: str, message: str) -> bool:
    if not config.RECRUITER_TOPIC_ARN or not company_id:
        return False
    try:
        _sns().publish(
            TopicArn=config.RECRUITER_TOPIC_ARN,
            Subject=subject[:100],
            Message=message,
            MessageAttributes={
                "companyId": {"DataType": "String", "StringValue": company_id}
            },
        )
        return True
    except Exception:  # noqa: BLE001
        logger.exception("recruiter alert could not be published")
        return False


def subscribe_company(company_id: str, contact_email: str) -> Optional[str]:
    """Called when an account becomes verified.

    SNS sends the address a confirmation link, and nothing is delivered until
    somebody follows it. That is a property of email subscriptions rather than a
    fault, and it is why the notification centre record is written on every event
    regardless of whether this subscription exists or has been confirmed.
    """
    if not config.RECRUITER_TOPIC_ARN or not contact_email:
        return None
    try:
        response = _sns().subscribe(
            TopicArn=config.RECRUITER_TOPIC_ARN,
            Protocol="email",
            Endpoint=contact_email,
            Attributes={
                "FilterPolicy": '{"companyId": ["' + company_id + '"]}',
                "FilterPolicyScope": "MessageAttributes",
            },
            ReturnSubscriptionArn=True,
        )
        return response.get("SubscriptionArn")
    except Exception:  # noqa: BLE001
        logger.exception("could not subscribe a company to the alert topic")
        return None


def unsubscribe(subscription_arn: Optional[str]) -> bool:
    """Called when an account is suspended or rejected.

    A pending subscription has no ARN worth removing, so one that does not look
    like an ARN is skipped rather than sent to SNS.
    """
    if not subscription_arn or not subscription_arn.startswith("arn:"):
        return False
    try:
        _sns().unsubscribe(SubscriptionArn=subscription_arn)
        return True
    except Exception:  # noqa: BLE001
        logger.exception("could not remove a company subscription")
        return False
