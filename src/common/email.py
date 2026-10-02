"""Transactional email through SES.

FR-8.1, FR-8.5 and FR-13.3. Sending never raises into the caller. FR-8.6 says a
submission must not fail because a notification could not be delivered, and the
same reasoning covers a status change: the record is already written, so an
email failure is logged and nothing more.
"""
import functools
import logging
import uuid
from datetime import timedelta
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, List, Optional

import boto3

from common import config
from common.time_utils import now_iso, parse_iso, to_ical_stamp

logger = logging.getLogger(__name__)


@functools.lru_cache(maxsize=1)
def _client():
    return boto3.client("ses")


def send(to_address: str, subject: str, body_text: str, body_html: Optional[str] = None) -> bool:
    if not to_address or not config.SENDER_EMAIL:
        return False
    body: Dict[str, Dict[str, str]] = {"Text": {"Data": body_text, "Charset": "UTF-8"}}
    if body_html:
        body["Html"] = {"Data": body_html, "Charset": "UTF-8"}
    try:
        _client().send_email(
            Source=config.SENDER_EMAIL,
            Destination={"ToAddresses": [to_address]},
            Message={"Subject": {"Data": subject[:200], "Charset": "UTF-8"}, "Body": body},
        )
        return True
    except Exception:  # noqa: BLE001
        logger.exception("email to %s could not be sent", _mask(to_address))
        return False


def send_with_calendar(
    to_addresses: List[str],
    subject: str,
    body_text: str,
    ics_content: str,
    *,
    method: str = "REQUEST",
) -> bool:
    """An iCalendar attachment rather than a synchronised calendar.

    Open decision 8.2 settled on this because an .ics file is understood by
    every common calendar application and needs no second authorisation flow per
    recruiter.
    """
    recipients = [address for address in to_addresses if address]
    if not recipients or not config.SENDER_EMAIL:
        return False

    message = MIMEMultipart("mixed")
    message["Subject"] = subject[:200]
    message["From"] = config.SENDER_EMAIL
    message["To"] = ", ".join(recipients)
    message.attach(MIMEText(body_text, "plain", "UTF-8"))

    attachment = MIMEApplication(ics_content.encode("utf-8"), _subtype="ics")
    attachment.add_header("Content-Disposition", "attachment", filename="interview.ics")
    attachment.add_header("Content-Type", f'text/calendar; method={method}; name="interview.ics"')
    message.attach(attachment)

    try:
        _client().send_raw_email(
            Source=config.SENDER_EMAIL,
            Destinations=recipients,
            RawMessage={"Data": message.as_string()},
        )
        return True
    except Exception:  # noqa: BLE001
        logger.exception("calendar invitation could not be sent")
        return False


def build_ics(
    *,
    uid: Optional[str],
    summary: str,
    description: str,
    starts_at: str,
    duration_minutes: int,
    location: str,
    organiser_email: str,
    attendee_emails: List[str],
    sequence: int = 0,
    method: str = "REQUEST",
    cancelled: bool = False,
) -> str:
    start = parse_iso(starts_at)
    if start is None:
        raise ValueError("interview start time is not a valid timestamp")
    end = start + timedelta(minutes=max(15, duration_minutes))
    end_stamp = end.strftime("%Y%m%dT%H%M%SZ")

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Job and Internship Application Tracker//EN",
        f"METHOD:{method}",
        "BEGIN:VEVENT",
        f"UID:{uid or uuid.uuid4().hex}@job-internship-tracker",
        f"DTSTAMP:{to_ical_stamp(now_iso())}",
        f"DTSTART:{to_ical_stamp(starts_at)}",
        f"DTEND:{end_stamp}",
        f"SEQUENCE:{sequence}",
        f"SUMMARY:{_escape(summary)}",
        f"DESCRIPTION:{_escape(description)}",
        f"LOCATION:{_escape(location)}",
        f"ORGANIZER:mailto:{organiser_email}",
    ]
    for address in attendee_emails:
        if address:
            lines.append(
                "ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:"
                f"mailto:{address}"
            )
    lines.append("STATUS:CANCELLED" if cancelled else "STATUS:CONFIRMED")
    lines.extend(["END:VEVENT", "END:VCALENDAR"])
    return "\r\n".join(lines)


def _escape(value: str) -> str:
    return (
        str(value)
        .replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def _mask(address: str) -> str:
    name, _, domain = address.partition("@")
    return f"{name[:2]}***@{domain}" if domain else "***"
