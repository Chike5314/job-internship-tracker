"""In application notifications.

FR-12.1 to FR-12.5. A notification row is written for every event that concerns
a user, independently of whether the matching email goes out. FR-12.3 is the
reason this never raises into the caller: a notification that cannot be written
must not take down the thing that caused it.
"""
import logging
import uuid
from typing import Optional

from common import config, dynamo
from common.time_utils import epoch_seconds, now_iso

logger = logging.getLogger(__name__)

STATUS_CHANGE = "STATUS_CHANGE"
NEW_APPLICATION = "NEW_APPLICATION"
VERIFICATION_RESULT = "VERIFICATION_RESULT"
INTERVIEW = "INTERVIEW"


def record(
    user_id: str,
    notification_type: str,
    message: str,
    link: Optional[str] = None,
) -> Optional[str]:
    if not user_id or not message:
        return None
    notification_id = uuid.uuid4().hex
    item = {
        "userId": user_id,
        "createdAt": now_iso(),
        "notificationId": notification_id,
        "type": notification_type,
        "message": message[:500],
        "read": False,
        "expiresAt": epoch_seconds(config.NOTIFICATION_TTL_DAYS),
    }
    if link:
        item["link"] = link[:500]
    try:
        dynamo.notifications().put_item(Item=item)
        return notification_id
    except Exception:  # noqa: BLE001
        logger.exception("could not write notification for user %s", user_id)
        return None
