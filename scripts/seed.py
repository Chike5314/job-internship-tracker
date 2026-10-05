#!/usr/bin/env python3
"""Seed a development deployment of Offerline.

Creates a verified company, publishes one posting of each opportunity type,
creates two applicants with a CV each, submits several applications spread
across the pipeline and schedules one interview. This is for two purposes: a
demo that does not depend on typing data in live, and a populated dev
environment for frontend work.

Only the REST API and boto3's Cognito admin calls are used, so this behaves
like a real client rather than reaching into DynamoDB directly. The API
requires a Cognito ID token in a raw Authorization header (no "Bearer "
prefix), so the applicant and company accounts this script creates are signed
in through pycognito, which speaks SRP the same way a browser SDK does at
sign in. The app client only allows ALLOW_USER_SRP_AUTH, so there is no
shortcut through USER_PASSWORD_AUTH, and SRP is fiddly enough (a fixed 3072
bit modulus, an HKDF derivation, a Cognito specific timestamp format) that
reusing a maintained implementation beats hand rolling it again here.

Usage:
    pip install pycognito
    python scripts/seed.py --api-url https://abc123.execute-api.us-east-1.amazonaws.com/dev \\
        --admin-token eyJraWQ...

The admin token has to belong to an account in the Admins group. Admin
accounts are created by hand in the Cognito console per the project's manual
deploy steps, so there is no way to script that part.

The Cognito user pool and app client are discovered from the persistence
stack's CloudFormation outputs (jiat-<stage>-persistence) unless
--user-pool-id and --client-id are given directly.

Safe to run more than once: an existing company, applicant, posting or
application is reused rather than recreated, and a status change that no
longer applies is skipped rather than treated as an error.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

import boto3
from pycognito.aws_srp import AWSSRP


def iso_in(days: int) -> str:
    moment = datetime.now(timezone.utc) + timedelta(days=days)
    return moment.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


# A minimal but structurally valid PDF. Content never matters here, only that
# every upload is a real file with the extension and content type the backend
# checks for.
SEED_PDF_BYTES = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n"
    b"trailer<</Root 1 0 R>>\n%%EOF"
)
SEED_CV_LABEL = "Seed resume"

POSTINGS = [
    {
        "title": "Backend Engineer",
        "description": (
            "Build and operate the services behind Offerline's application "
            "pipeline. You will work across Lambda, DynamoDB and the event "
            "driven notification layer."
        ),
        "opportunityType": "FULL_TIME_JOB",
        "workModality": "REMOTE",
        "experienceLevel": "MID",
        "openings": 2,
        "city": "Lagos",
        "country": "Nigeria",
        "skills": ["Python", "AWS", "DynamoDB"],
        "applicationDeadline": iso_in(60),
        "salary": {
            "disclosed": True,
            "min": 3000000,
            "max": 4500000,
            "currency": "NGN",
            "period": "YEAR",
        },
    },
    {
        "title": "Marketing Intern",
        "description": (
            "Support campaign planning and content production for a growing "
            "recruiter facing product."
        ),
        "opportunityType": "PROFESSIONAL_INTERNSHIP",
        "workModality": "HYBRID",
        "experienceLevel": "ENTRY",
        "openings": 1,
        "city": "Nairobi",
        "country": "Kenya",
        "skills": ["Marketing", "Copywriting"],
        "applicationDeadline": iso_in(45),
        "duration": "3 months",
    },
    {
        "title": "Research Intern",
        "description": (
            "Assist the data team with analysis of application funnel "
            "metrics under academic supervision."
        ),
        "opportunityType": "ACADEMIC_INTERNSHIP",
        "workModality": "ONSITE",
        "experienceLevel": "ENTRY",
        "openings": 1,
        "city": "Accra",
        "country": "Ghana",
        "skills": ["Data analysis", "SQL"],
        "applicationDeadline": iso_in(45),
        "duration": "1 semester",
    },
]

# Published and left alone: no seeded applicant applies to these, so there is
# always something open for a test applicant to apply to by hand.
EXTRA_POSTINGS = [
    {
        "title": "Robotics Software Engineer",
        "description": (
            "Write the software that drives Acme's warehouse robots, from motion planning "
            "to the dashboards operators use every day.\n\n"
            "You will join a team of six engineers in Douala, work closely with the "
            "hardware group, and ship to customers every two weeks."
        ),
        "opportunityType": "FULL_TIME_JOB",
        "workModality": "HYBRID",
        "experienceLevel": "MID",
        "openings": 2,
        "city": "Douala",
        "country": "Cameroon",
        "skills": ["Python", "C++", "ROS", "Linux"],
        "applicationDeadline": iso_in(45),
        "startDate": iso_in(60),
        "salary": {
            "disclosed": True,
            "min": 700000,
            "max": 950000,
            "currency": "XAF",
            "period": "MONTH",
        },
        "additionalDetails": [{"label": "Team", "value": "Six engineers, plus the hardware group"}],
    },
]

APPLICANT_SPECS = [
    {
        "email": "amara.nwosu@example.com",
        "fullName": "Amara Nwosu",
        "skills": ["Python", "React", "SQL"],
        "academicInfo": {
            "schoolName": "University of Lagos",
            "fieldOfStudy": "Computer Science",
            "degreeLevel": "BACHELORS",
        },
    },
    {
        "email": "diego.santos@example.com",
        "fullName": "Diego Santos",
        "skills": ["Marketing", "Copywriting", "Analytics"],
        "academicInfo": {
            "schoolName": "Universidade de Sao Paulo",
            "fieldOfStudy": "Business Administration",
            "degreeLevel": "BACHELORS",
        },
    },
]

# Which of the default document requirements each opportunity type needs
# beyond the CV, which is always supplied via reuseCvId.
APPLICATION_FILE_DOCS = {
    "FULL_TIME_JOB": ["coverLetter"],
    "PROFESSIONAL_INTERNSHIP": ["coverLetter"],
    "ACADEMIC_INTERNSHIP": ["coverLetter", "transcript", "schoolAuthorisation"],
}
APPLICATION_TEXT_ANSWERS = {
    "PROFESSIONAL_INTERNSHIP": {
        "availability": "Available Monday to Friday, 9am to 5pm, starting immediately."
    },
}


def log(message: str) -> None:
    print(f"[seed] {message}")


# ----------------------------------------------------------------------
# Cognito SRP sign in. The web app client only allows ALLOW_USER_SRP_AUTH, so
# this is what a real sign in does behind the scenes rather than a shortcut
# taken only for this script. pycognito implements the protocol; this is a
# thin wrapper that raises if a sign in gets diverted into some other
# challenge, which should not happen for an account this script just set a
# permanent password on.
# ----------------------------------------------------------------------
def srp_login(idp, pool_id: str, client_id: str, username: str, password: str) -> str:
    srp = AWSSRP(username=username, password=password, pool_id=pool_id, client_id=client_id, client=idp)
    tokens = srp.authenticate_user()
    if "AuthenticationResult" not in tokens:
        raise RuntimeError(
            f"Cognito asked for another challenge ({tokens.get('ChallengeName')}) "
            f"signing in {username}."
        )
    return tokens["AuthenticationResult"]["IdToken"]


# ----------------------------------------------------------------------
# A small HTTP client. No dependency beyond the standard library, since the
# rest of the project only needs boto3 and botocore.
# ----------------------------------------------------------------------
class Api:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    def call(self, method: str, path: str, token: str = None, body: dict = None):
        url = self.base_url + path
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Content-Type": "application/json"} if data is not None else {}
        if token:
            headers["Authorization"] = token
        request = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(request) as response:
                raw = response.read()
                return response.status, (json.loads(raw) if raw else {})
        except urllib.error.HTTPError as exc:
            raw = exc.read()
            try:
                payload = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                payload = {"error": {"code": "HTTP_ERROR", "message": raw.decode("utf-8", "replace")}}
            return exc.code, payload

    def must(self, method: str, path: str, token: str = None, body: dict = None,
              ok_statuses=(200, 201, 202)) -> dict:
        status, payload = self.call(method, path, token=token, body=body)
        if status not in ok_statuses:
            error = payload.get("error", {})
            raise RuntimeError(
                f"{method} {path} -> {status} {error.get('code', '')}: "
                f"{error.get('message', '')}"
            )
        return payload


def put_document(upload_url: str, content_type: str, data: bytes) -> None:
    request = urllib.request.Request(
        upload_url, data=data, method="PUT", headers={"Content-Type": content_type}
    )
    with urllib.request.urlopen(request) as response:
        response.read()


# ----------------------------------------------------------------------
# AWS discovery
# ----------------------------------------------------------------------
def discover_user_pool(session, stack_prefix: str):
    cf = session.client("cloudformation")
    stack_name = f"{stack_prefix}-persistence"
    try:
        stacks = cf.describe_stacks(StackName=stack_name)["Stacks"]
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            f"Could not read outputs from stack {stack_name!r}: {exc}\n"
            "Pass --user-pool-id and --client-id directly if the stack name differs."
        ) from exc
    outputs = {o["OutputKey"]: o["OutputValue"] for o in stacks[0].get("Outputs", [])}
    pool_id = outputs.get("UserPoolId")
    client_id = outputs.get("UserPoolClientId")
    if not pool_id or not client_id:
        raise RuntimeError(f"Stack {stack_name!r} has no UserPoolId/UserPoolClientId outputs.")
    return pool_id, client_id


# ----------------------------------------------------------------------
# Company
# ----------------------------------------------------------------------
def find_company_by_email(api: Api, admin_token: str, email: str) -> dict:
    for status in ("VERIFIED", "PENDING_VERIFICATION", "REJECTED", "SUSPENDED"):
        payload = api.must("GET", f"/companies?status={status}", token=admin_token)
        for company in payload.get("companies", []):
            if company.get("contactEmail", "").lower() == email.lower():
                return company
    raise RuntimeError(
        f"Could not find an existing company account for {email}. It may have "
        "been registered under a different address."
    )


def ensure_company(api: Api, idp, pool_id: str, client_id: str, admin_token: str,
                     email: str, name: str, password: str):
    status, payload = api.call(
        "POST", "/admin/companies", token=admin_token,
        body={
            "companyName": name,
            "contactEmail": email,
            "companyWebsiteUrl": f"https://{name.lower().replace(' ', '')}.example.com",
            "verifyNow": True,
        },
    )
    if status == 201:
        company = payload["company"]
        log(f"  created, companyId={company['companyId']}")
    else:
        code = payload.get("error", {}).get("code", "")
        if code != "CONFLICT":
            raise RuntimeError(f"could not create company: {status} {payload}")
        log("  already registered, looking it up")
        company = find_company_by_email(api, admin_token, email)
        if company.get("verificationStatus") != "VERIFIED":
            api.must(
                "PATCH", f"/companies/{company['companyId']}/status", token=admin_token,
                body={"verificationStatus": "VERIFIED", "note": "Verified by the seed script."},
            )
            log("  brought back to VERIFIED")

    idp.admin_set_user_password(UserPoolId=pool_id, Username=email, Password=password, Permanent=True)
    token = srp_login(idp, pool_id, client_id, email, password)
    return company["companyId"], token


# ----------------------------------------------------------------------
# Postings
# ----------------------------------------------------------------------
def ensure_posting(api: Api, company_token: str, spec: dict) -> str:
    listing = api.must("GET", "/jobs/mine", token=company_token)
    for job in listing.get("jobs", []):
        if job.get("title") == spec["title"]:
            if job.get("postingStatus") != "PUBLISHED":
                api.must(
                    "PATCH", f"/jobs/{job['jobId']}", token=company_token,
                    body={"postingStatus": "PUBLISHED"},
                )
            return job["jobId"]

    created = api.must("POST", "/jobs", token=company_token, body=spec)
    job_id = created["job"]["jobId"]
    api.must("PATCH", f"/jobs/{job_id}", token=company_token, body={"postingStatus": "PUBLISHED"})
    return job_id


# ----------------------------------------------------------------------
# Applicants and their CVs
# ----------------------------------------------------------------------
def ensure_cv(api: Api, token: str) -> dict:
    existing = api.must("GET", "/profile/cvs", token=token)
    for cv in existing.get("cvs", []):
        if cv.get("label") == SEED_CV_LABEL:
            return cv
    upload = api.must(
        "POST", "/profile/upload-url", token=token,
        body={
            "documentKind": "cv",
            "fileName": "resume.pdf",
            "contentType": "application/pdf",
            "label": SEED_CV_LABEL,
        },
    )
    put_document(upload["uploadUrl"], "application/pdf", SEED_PDF_BYTES)
    return upload["cv"]


def ensure_applicant(api: Api, idp, pool_id: str, client_id: str, spec: dict, password: str) -> dict:
    email = spec["email"]
    try:
        idp.admin_get_user(UserPoolId=pool_id, Username=email)
    except idp.exceptions.UserNotFoundException:
        idp.admin_create_user(
            UserPoolId=pool_id,
            Username=email,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "name", "Value": spec["fullName"]},
                {"Name": "custom:accountType", "Value": "individual"},
            ],
            MessageAction="SUPPRESS",
        )

    idp.admin_set_user_password(UserPoolId=pool_id, Username=email, Password=password, Permanent=True)
    groups = [
        group["GroupName"]
        for group in idp.admin_list_groups_for_user(UserPoolId=pool_id, Username=email, Limit=10)["Groups"]
    ]
    if "Applicants" not in groups:
        idp.admin_add_user_to_group(UserPoolId=pool_id, Username=email, GroupName="Applicants")

    token = srp_login(idp, pool_id, client_id, email, password)
    api.must(
        "POST", "/profile", token=token,
        body={
            "fullName": spec["fullName"],
            "skills": spec["skills"],
            "academicInfo": spec["academicInfo"],
        },
    )
    cv = ensure_cv(api, token)
    return {"email": email, "token": token, "cv": cv}


# ----------------------------------------------------------------------
# Applications and status
# ----------------------------------------------------------------------
def upload_application_document(api: Api, token: str, job_id: str, document_key: str) -> str:
    upload = api.must(
        "POST", "/applications/upload-url", token=token,
        body={
            "jobId": job_id,
            "documentKey": document_key,
            "fileName": f"{document_key}.pdf",
            "contentType": "application/pdf",
        },
    )
    put_document(upload["uploadUrl"], "application/pdf", SEED_PDF_BYTES)
    return upload["s3Key"]


def find_existing_application(api: Api, token: str, job_id: str):
    listing = api.must("GET", "/applications/me", token=token)
    for application in listing.get("applications", []):
        if application.get("jobId") == job_id:
            return application
    return None


def ensure_application(api: Api, applicant: dict, job_id: str, opportunity_type: str,
                         cover_letter_text: str = None) -> dict:
    existing = find_existing_application(api, applicant["token"], job_id)
    if existing:
        log(f"    already applied, status={existing['status']}")
        return existing

    documents = {}
    for key in APPLICATION_FILE_DOCS.get(opportunity_type, []):
        documents[key] = upload_application_document(api, applicant["token"], job_id, key)
    answers = APPLICATION_TEXT_ANSWERS.get(opportunity_type, {})

    body = {
        "jobId": job_id,
        "documents": documents,
        "answers": answers,
        "reuseCvId": applicant["cv"]["cvId"],
    }
    if cover_letter_text:
        body["coverLetter"] = cover_letter_text

    status, payload = api.call("POST", "/applications", token=applicant["token"], body=body)
    if status == 202:
        application = payload["application"]
        log(f"    submitted, applicationId={application['applicationId']}")
        return application

    code = payload.get("error", {}).get("code", "")
    if code == "DUPLICATE_APPLICATION":
        existing = find_existing_application(api, applicant["token"], job_id)
        if existing:
            return existing
    raise RuntimeError(f"could not submit application to {job_id}: {status} {payload}")


def advance_status(api: Api, company_token: str, application_id: str, target: str) -> None:
    status, payload = api.call(
        "PATCH", f"/applications/{application_id}/status", token=company_token,
        body={"status": target, "note": "Moved by the seed script."},
    )
    if status == 200:
        log(f"    -> {target}")
        return
    if status == 409:
        # A rerun where this application is already at, or past, the target
        # status lands here, which is exactly what makes this idempotent.
        log(f"    -> {target} skipped (not reachable from the current status)")
        return
    raise RuntimeError(f"could not move application {application_id} to {target}: {status} {payload}")


# ----------------------------------------------------------------------
def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Seed a development deployment with a verified company, published "
            "postings across all three opportunity types, two applicants with "
            "CVs, applications spread across the pipeline and one scheduled "
            "interview. Safe to run more than once."
        ),
    )
    parser.add_argument(
        "--api-url", required=True,
        help="Base URL from the ApiUrl stack output, e.g. "
             "https://abc123.execute-api.us-east-1.amazonaws.com/dev",
    )
    parser.add_argument(
        "--admin-token", required=True,
        help="A Cognito ID token for a signed in account in the Admins group.",
    )
    parser.add_argument("--stage", default="dev", help="Deployment stage (default: dev)")
    parser.add_argument(
        "--stack-prefix", default=None,
        help="Override the CDK stack prefix instead of deriving it from --stage (jiat-<stage>).",
    )
    parser.add_argument("--user-pool-id", default=None, help="Skip stack discovery.")
    parser.add_argument("--client-id", default=None, help="Skip stack discovery.")
    parser.add_argument("--region", default=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))
    parser.add_argument("--profile", default=None, help="AWS named profile for the Cognito calls.")
    parser.add_argument(
        "--password", default="SeedData!2026",
        help="Password set on every account this script creates or reuses.",
    )
    parser.add_argument("--company-email", default="acme.robotics@example.com")
    parser.add_argument("--company-name", default="Acme Robotics")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    session = boto3.Session(profile_name=args.profile, region_name=args.region)

    pool_id, client_id = args.user_pool_id, args.client_id
    if not pool_id or not client_id:
        stack_prefix = args.stack_prefix or f"jiat-{args.stage}"
        log(f"discovering Cognito ids from {stack_prefix}-persistence")
        discovered_pool, discovered_client = discover_user_pool(session, stack_prefix)
        pool_id = pool_id or discovered_pool
        client_id = client_id or discovered_client
    log(f"user pool {pool_id}")

    idp = session.client("cognito-idp")
    api = Api(args.api_url)

    log("company")
    company_id, company_token = ensure_company(
        api, idp, pool_id, client_id, args.admin_token,
        args.company_email, args.company_name, args.password,
    )

    log("postings")
    job_ids = {}
    for spec in POSTINGS:
        job_id = ensure_posting(api, company_token, spec)
        job_ids[spec["opportunityType"]] = job_id
        log(f"  {spec['title']} -> {job_id}")
    for spec in EXTRA_POSTINGS:
        log(f"  {spec['title']} -> {ensure_posting(api, company_token, spec)} (open to apply)")

    log("applicants")
    applicants = {}
    for spec in APPLICANT_SPECS:
        applicants[spec["email"]] = ensure_applicant(api, idp, pool_id, client_id, spec, args.password)
        log(f"  {spec['fullName']} <{spec['email']}>")

    a1 = applicants[APPLICANT_SPECS[0]["email"]]
    a2 = applicants[APPLICANT_SPECS[1]["email"]]
    full_time = job_ids["FULL_TIME_JOB"]
    professional = job_ids["PROFESSIONAL_INTERNSHIP"]
    academic = job_ids["ACADEMIC_INTERNSHIP"]

    log("applications")

    log("  applicant 1 -> full time job, left submitted")
    app1 = ensure_application(
        api, a1, full_time, "FULL_TIME_JOB",
        cover_letter_text="I would like to be considered for this role.",
    )

    log("  applicant 2 -> full time job, moved to under review")
    app2 = ensure_application(
        api, a2, full_time, "FULL_TIME_JOB",
        cover_letter_text="Please find my application attached.",
    )
    advance_status(api, company_token, app2["applicationId"], "UNDER_REVIEW")

    log("  applicant 1 -> professional internship, interview scheduled")
    app3 = ensure_application(api, a1, professional, "PROFESSIONAL_INTERNSHIP")
    if app3["status"] in ("SUBMITTED", "UNDER_REVIEW"):
        api.must(
            "POST", f"/applications/{app3['applicationId']}/interview", token=company_token,
            body={
                "scheduledAt": iso_in(5),
                "mode": "ONLINE",
                "durationMinutes": 45,
                "locationOrLink": "https://meet.example.com/seed-interview",
            },
        )
        log("    interview scheduled")
    else:
        log(f"    already past submission, status={app3['status']}")

    log("  applicant 2 -> academic internship, offer extended")
    app4 = ensure_application(api, a2, academic, "ACADEMIC_INTERNSHIP")
    advance_status(api, company_token, app4["applicationId"], "UNDER_REVIEW")
    advance_status(api, company_token, app4["applicationId"], "OFFER_EXTENDED")

    log("  applicant 1 -> academic internship, rejected")
    app5 = ensure_application(api, a1, academic, "ACADEMIC_INTERNSHIP")
    advance_status(api, company_token, app5["applicationId"], "REJECTED")

    summary = {
        "companyId": company_id,
        "postings": job_ids,
        "applicants": {email: args.password for email in applicants},
        "applications": {
            "submitted": app1["applicationId"],
            "underReview": app2["applicationId"],
            "interviewScheduled": app3["applicationId"],
            "offerExtended": app4["applicationId"],
            "rejected": app5["applicationId"],
        },
    }
    log("done")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as exc:
        print(f"seed script failed: {exc}", file=sys.stderr)
        sys.exit(1)
