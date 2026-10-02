"""S3 access.

FR-5.4, FR-7.1 and FR-7.2. Document bytes never pass through Lambda. The API
hands out a presigned URL scoped to one key, and the browser transfers the file
directly. Every key is generated here rather than accepted from a client, so a
caller cannot name a path belonging to someone else.
"""
import functools
import re
import uuid
from typing import Any, Dict, Optional

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from common import config
from common.errors import ForbiddenError

# Key prefixes, one per kind of document. Separation by prefix rather than by
# bucket keeps the permission model small enough to reason about.
PREFIXES = {
    "cv": "cvs",
    "coverLetter": "cover-letters",
    "transcript": "transcripts",
    "schoolAuthorisation": "authorization-letters",
    "profilePicture": "profile-pictures",
    "companyLogo": "company-logos",
    "export": "exports",
}

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


@functools.lru_cache(maxsize=1)
def _client():
    return boto3.client("s3", config=BotoConfig(signature_version="s3v4"))


def safe_file_name(file_name: str) -> str:
    cleaned = _SAFE_NAME.sub("-", file_name.strip())[-120:]
    return cleaned.lstrip("-.") or "document"


def build_key(owner_id: str, document_kind: str, file_name: str) -> str:
    """Every upload gets a fresh key.

    FR-2.6. Nothing is ever written over, so a document attached to a submitted
    application stays exactly as it was submitted.
    """
    prefix = PREFIXES.get(document_kind, "documents")
    return f"{prefix}/{owner_id}/{uuid.uuid4().hex}-{safe_file_name(file_name)}"


def presigned_upload(key: str, content_type: Optional[str] = None) -> Dict[str, Any]:
    params: Dict[str, Any] = {"Bucket": config.DOCUMENTS_BUCKET, "Key": key}
    if content_type:
        params["ContentType"] = content_type
    url = _client().generate_presigned_url(
        "put_object",
        Params=params,
        ExpiresIn=config.PRESIGNED_UPLOAD_TTL_SECONDS,
    )
    return {
        "uploadUrl": url,
        "s3Key": key,
        "expiresInSeconds": config.PRESIGNED_UPLOAD_TTL_SECONDS,
    }


def presigned_download(key: str, download_name: Optional[str] = None) -> str:
    params: Dict[str, Any] = {"Bucket": config.DOCUMENTS_BUCKET, "Key": key}
    if download_name:
        params["ResponseContentDisposition"] = (
            f'attachment; filename="{safe_file_name(download_name)}"'
        )
    return _client().generate_presigned_url(
        "get_object",
        Params=params,
        ExpiresIn=config.PRESIGNED_DOWNLOAD_TTL_SECONDS,
    )


def put_object(key: str, body: bytes, content_type: str = "application/octet-stream") -> str:
    _client().put_object(
        Bucket=config.DOCUMENTS_BUCKET,
        Key=key,
        Body=body,
        ContentType=content_type,
        ServerSideEncryption="AES256",
    )
    return key


def get_object_bytes(key: str, max_bytes: int = 8_000_000) -> bytes:
    response = _client().get_object(Bucket=config.DOCUMENTS_BUCKET, Key=key)
    return response["Body"].read(max_bytes)


def get_object_text(key: str, max_bytes: int = 2_000_000) -> str:
    return get_object_bytes(key, max_bytes).decode("utf-8", errors="ignore")


def object_exists(key: str) -> bool:
    """Whether the browser's direct upload to this key actually landed.

    A presigned URL is only an offer. The transfer happens between the browser
    and S3 with nothing in between, so the API finds out whether it succeeded by
    asking for the object.
    """
    try:
        _client().head_object(Bucket=config.DOCUMENTS_BUCKET, Key=key)
        return True
    except ClientError as error:
        status = error.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        if status == 404 or error.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
            return False
        raise


def assert_key_owned_by(key: str, owner_id: str) -> None:
    """A key a client sends back has to be one issued to that same caller.

    Without this check an applicant could attach a document belonging to
    somebody else simply by naming its key.
    """
    if f"/{owner_id}/" not in key:
        raise ForbiddenError("That document does not belong to you.")
