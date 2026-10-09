#!/usr/bin/env python3
"""Create the Mountainview demo postings from docs/DEMO_DATA.md, as the company.

The company account signs in itself: the password is asked for at the prompt
and never echoed or stored. A posting whose title the account already has is
left alone, so this is safe to run more than once, and it does not touch the
Cloud Engineering Intern posting if that was made by hand.

Usage, from the project folder with the .venv active:
    python scripts/create_demo_postings.py --email you+mountainview@gmail.com

A posting is published only once an admin has verified the company. Before
that it is saved as a draft and the script says so.
"""
import argparse
import getpass
import os
import sys
from datetime import datetime, timedelta, timezone

import boto3

sys.path.insert(0, os.path.dirname(__file__))
from seed import Api, discover_user_pool, srp_login  # noqa: E402

API_URL = "https://ng6nuspkv4.execute-api.us-east-1.amazonaws.com/dev"


def in_days(days: int) -> str:
    moment = datetime.now(timezone.utc) + timedelta(days=days)
    return moment.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


CV = {"key": "cv", "label": "CV or resume", "required": True, "kind": "FILE"}
COVER = {"key": "coverLetter", "label": "Cover letter", "required": True, "kind": "FILE"}
PORTFOLIO = {"key": "portfolio", "label": "Portfolio links", "required": False, "kind": "TEXT"}

POSTINGS = [
    {
        "title": "Junior Data Analyst",
        "opportunityType": "FULL_TIME_JOB",
        "workModality": "HYBRID",
        "city": "Douala",
        "country": "Cameroon",
        "experienceLevel": "ENTRY",
        "openings": 1,
        "applicationDeadline": in_days(30),
        "salary": {"disclosed": True, "min": 250000, "max": 350000, "currency": "XAF", "period": "MONTH"},
        "skills": ["SQL", "Excel", "Power BI", "Python"],
        "documentRequirements": [CV, COVER],
        "description": (
            "Turn our clients' data into clear reports. You will clean data, build "
            "dashboards in Power BI and present findings to clinic and school managers in "
            "Douala. Two days a week from home after your first month."
        ),
    },
    {
        "title": "Marketing and Communications Intern",
        "opportunityType": "PROFESSIONAL_INTERNSHIP",
        "workModality": "REMOTE",
        "city": "Yaounde",
        "country": "Cameroon",
        "experienceLevel": "ENTRY",
        "openings": 1,
        "duration": "6 months",
        "applicationDeadline": in_days(30),
        "salary": {"disclosed": True, "min": 50000, "max": 50000, "currency": "XAF", "period": "MONTH"},
        "skills": ["Content writing", "Social media", "Canva", "French"],
        "documentRequirements": [CV, COVER, PORTFOLIO],
        "description": (
            "Help us tell schools and clinics across Cameroon what our software does. "
            "You will write posts in English and French, design simple visuals and keep "
            "our pages active. Fully remote, with a weekly call with the team."
        ),
    },
]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--email", required=True, help="The company account's email.")
    parser.add_argument("--api-url", default=API_URL)
    parser.add_argument("--region", default="us-east-1")
    args = parser.parse_args()

    password = getpass.getpass(f"Password for {args.email}: ")
    session = boto3.Session(region_name=args.region)
    pool_id, client_id = discover_user_pool(session, "jiat-dev")
    token = srp_login(session.client("cognito-idp"), pool_id, client_id, args.email, password)
    api = Api(args.api_url)

    existing = {job["title"]: job for job in api.must("GET", "/jobs/mine", token=token).get("jobs", [])}
    for spec in POSTINGS:
        title = spec["title"]
        if title in existing:
            print(f"{title}: already there ({existing[title].get('postingStatus')}), left as it is")
            continue
        created = api.must("POST", "/jobs", token=token, body=spec)
        job_id = created["job"]["jobId"]
        status, payload = api.call(
            "PATCH", f"/jobs/{job_id}", token=token, body={"postingStatus": "PUBLISHED"}
        )
        if status == 200:
            print(f"{title}: created and published")
        else:
            reason = payload.get("error", {}).get("message", status)
            print(f"{title}: created as a draft, not published ({reason})")


if __name__ == "__main__":
    main()
