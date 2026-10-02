"""Record lookups and the ownership checks that go with them.

Every one of these exists because a group claim proves what kind of caller is
on the line but not that it is the right one. FR-4.9, FR-6.9 and FR-10.5 are all
this same check applied to different records.
"""
from typing import Any, Dict

from common import dynamo
from common.auth import Caller
from common.errors import ForbiddenError, NotFoundError


def get_user(user_id: str) -> Dict[str, Any]:
    item = dynamo.users().get_item(Key={"userId": user_id}).get("Item")
    if not item:
        raise NotFoundError("We could not find that profile.")
    return item


def find_user(user_id: str) -> Dict[str, Any]:
    return dynamo.users().get_item(Key={"userId": user_id}).get("Item") or {}


def get_company(company_id: str) -> Dict[str, Any]:
    item = dynamo.companies().get_item(Key={"companyId": company_id}).get("Item")
    if not item:
        raise NotFoundError("We could not find that company.")
    return item


def find_company(company_id: str) -> Dict[str, Any]:
    return dynamo.companies().get_item(Key={"companyId": company_id}).get("Item") or {}


def get_job(job_id: str) -> Dict[str, Any]:
    item = dynamo.jobs().get_item(Key={"jobId": job_id}).get("Item")
    if not item:
        raise NotFoundError("We could not find that posting.")
    return item


def get_application(application_id: str) -> Dict[str, Any]:
    item = (
        dynamo.applications()
        .get_item(Key={"applicationId": application_id})
        .get("Item")
    )
    if not item:
        raise NotFoundError("We could not find that application.")
    return item


def assert_owns_job(caller: Caller, job: Dict[str, Any]) -> None:
    if caller.is_admin:
        return
    if job.get("companyId") != caller.user_id:
        # Says nothing about whether the posting exists, per the 403 rule in the
        # validation table.
        raise ForbiddenError("You are not allowed to work with this posting.")


def assert_owns_company(caller: Caller, company_id: str) -> None:
    if caller.is_admin:
        return
    if company_id != caller.user_id:
        raise ForbiddenError("You are not allowed to work with this account.")


def assert_can_read_application(caller: Caller, application: Dict[str, Any]) -> None:
    if caller.is_admin:
        return
    if caller.is_applicant and application.get("applicantId") == caller.user_id:
        return
    if caller.is_recruiter and application.get("companyId") == caller.user_id:
        return
    raise ForbiddenError("You are not allowed to view this application.")
