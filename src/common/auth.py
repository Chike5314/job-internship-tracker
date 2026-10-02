"""Caller identity.

FR-1.5. The identity used by every handler comes from the token claims that API
Gateway placed in the request context. A user identifier in a request body is
never trusted, and no handler reads one.
"""
from dataclasses import dataclass
from typing import Any, Dict, List

from common.errors import ForbiddenError, UnauthorizedError

APPLICANTS = "Applicants"
RECRUITERS = "Recruiters"
ADMINS = "Admins"


@dataclass(frozen=True)
class Caller:
    user_id: str
    email: str
    groups: List[str]
    name: str = ""

    @property
    def is_applicant(self) -> bool:
        return APPLICANTS in self.groups

    @property
    def is_recruiter(self) -> bool:
        return RECRUITERS in self.groups

    @property
    def is_admin(self) -> bool:
        return ADMINS in self.groups

    def require(self, *groups: str) -> None:
        if not any(g in self.groups for g in groups):
            # Deliberately says nothing about whether the target exists, which is
            # the behaviour the SRS validation table asks for on a 403.
            raise ForbiddenError("You are not allowed to perform this action.")


def _split_groups(raw: Any) -> List[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(g) for g in raw]
    text = str(raw).strip()
    if text.startswith("[") and text.endswith("]"):
        text = text[1:-1]
    separators = "," if "," in text else " "
    return [g.strip() for g in text.split(separators) if g.strip()]


def get_caller(event: Dict[str, Any]) -> Caller:
    claims = (
        event.get("requestContext", {}).get("authorizer", {}).get("claims") or {}
    )
    user_id = claims.get("sub")
    if not user_id:
        raise UnauthorizedError("Sign in to continue.")
    return Caller(
        user_id=user_id,
        email=claims.get("email", ""),
        groups=_split_groups(claims.get("cognito:groups")),
        name=claims.get("name") or claims.get("cognito:username") or "",
    )


# There is deliberately no optional caller helper here. A route either has the
# Cognito authorizer attached or it does not, and API Gateway populates
# requestContext.authorizer.claims only in the first case, whatever the client
# sends in the Authorization header. So a handler behind a public route can
# never see who is calling, and a helper that returns None instead of raising
# only hides that: the signed in branch is unreachable and the route quietly
# serves everyone the anonymous answer. A route that has to behave differently
# for a signed in caller gets an authorizer protected counterpart of its own,
# which is what GET /jobs/mine, GET /jobs/mine/{id} and GET /companies/mine are.
