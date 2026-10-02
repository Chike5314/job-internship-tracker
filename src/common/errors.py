"""Error types.

Every failure a handler can produce on purpose is one of these. They carry the
HTTP status and the machine readable code required by FR-11.2, and the message
is written for a person reading it in the interface. Nothing internal, no stack
traces and no AWS resource names, which is FR-11.3.
"""
from typing import Any, Dict, Optional


class AppError(Exception):
    status_code = 500
    code = "INTERNAL_ERROR"

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def to_body(self) -> Dict[str, Any]:
        body: Dict[str, Any] = {"code": self.code, "message": self.message}
        if self.details:
            body["details"] = self.details
        return {"error": body}


class ValidationError(AppError):
    status_code = 400
    code = "VALIDATION_FAILED"


class MissingDocumentsError(AppError):
    """Raised when a submission omits something the posting marks as required.

    The response carries the posting's full requirement list rather than only the
    first missing item, so the interface can show the applicant everything that
    is still outstanding in one pass.
    """

    status_code = 400
    code = "REQUIRED_DOCUMENTS_MISSING"


class UnauthorizedError(AppError):
    status_code = 401
    code = "UNAUTHORIZED"


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"


class DuplicateApplicationError(ConflictError):
    code = "DUPLICATE_APPLICATION"


class PostingNotOpenError(ConflictError):
    code = "POSTING_NOT_OPEN"


class InvalidTransitionError(ConflictError):
    code = "INVALID_STATUS_TRANSITION"


class ApplicationFrozenError(ConflictError):
    code = "APPLICATION_FROZEN"
