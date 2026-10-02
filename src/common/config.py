"""Runtime configuration read from the environment set by the CDK stack."""
import os

STAGE = os.environ.get("STAGE", "dev")

USERS_TABLE = os.environ.get("USERS_TABLE", "")
COMPANIES_TABLE = os.environ.get("COMPANIES_TABLE", "")
JOBS_TABLE = os.environ.get("JOBS_TABLE", "")
APPLICATIONS_TABLE = os.environ.get("APPLICATIONS_TABLE", "")
NOTIFICATIONS_TABLE = os.environ.get("NOTIFICATIONS_TABLE", "")

DOCUMENTS_BUCKET = os.environ.get("DOCUMENTS_BUCKET", "")
SUBMISSION_QUEUE_URL = os.environ.get("SUBMISSION_QUEUE_URL", "")
RECRUITER_TOPIC_ARN = os.environ.get("RECRUITER_TOPIC_ARN", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "")
USER_POOL_ID = os.environ.get("USER_POOL_ID", "")
PARSING_SECRET_ARN = os.environ.get("PARSING_SECRET_ARN", "")

ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()
]

# FR-5.5. Presigned URLs stop working fifteen minutes after they are issued.
PRESIGNED_UPLOAD_TTL_SECONDS = 15 * 60
PRESIGNED_DOWNLOAD_TTL_SECONDS = 5 * 60

# FR-5.8
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

# FR-12.4
NOTIFICATION_TTL_DAYS = 90

# FR-2.7
CV_REUSE_LIMIT = 10

# FR-14.1
BULK_ACTION_LIMIT = 50
