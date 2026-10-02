"""Shared setup for the integration tests.

These tests run the real handler code against moto, which stands in for AWS in
process. That is the layer the unit tests cannot reach: index definitions,
conditional writes, presigned URLs and the shape of an API Gateway event are all
things that only go wrong once something actually calls AWS.

The environment is set here rather than in a fixture because common.config reads
it at import time, and conftest is imported before any test module.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

# Credentials moto expects. Nothing here reaches a real account, and setting them
# explicitly stops boto3 from finding a real profile on the developer machine.
os.environ["AWS_ACCESS_KEY_ID"] = "testing"
os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
os.environ["AWS_SECURITY_TOKEN"] = "testing"
os.environ["AWS_SESSION_TOKEN"] = "testing"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

os.environ["STAGE"] = "test"
os.environ["USERS_TABLE"] = "test-users"
os.environ["COMPANIES_TABLE"] = "test-companies"
os.environ["JOBS_TABLE"] = "test-jobs"
os.environ["APPLICATIONS_TABLE"] = "test-applications"
os.environ["NOTIFICATIONS_TABLE"] = "test-notifications"
os.environ["DOCUMENTS_BUCKET"] = "test-documents"
os.environ["SENDER_EMAIL"] = "no-reply@example.com"
os.environ["ALLOWED_ORIGINS"] = "*"

import boto3  # noqa: E402
import pytest  # noqa: E402
from moto import mock_aws  # noqa: E402

REGION = "us-east-1"


def _clear_cached_clients():
    """Every module caches its boto3 client for the life of the container.

    A cached client holds a connection to the previous moto context, so the
    caches are cleared between tests or the second test talks to a world that no
    longer exists.
    """
    from common import alerts, cognito, dynamo, email, parsing, storage

    for cached in (
        dynamo._resource,
        dynamo.table,
        storage._client,
        email._client,
        alerts._sns,
        cognito._idp,
        parsing._secrets_client,
        parsing.parsing_credentials,
    ):
        cached.cache_clear()


def _create_tables(ddb):
    on_demand = {"BillingMode": "PAY_PER_REQUEST"}

    ddb.create_table(
        TableName="test-users",
        KeySchema=[{"AttributeName": "userId", "KeyType": "HASH"}],
        AttributeDefinitions=[{"AttributeName": "userId", "AttributeType": "S"}],
        **on_demand,
    )

    ddb.create_table(
        TableName="test-companies",
        KeySchema=[{"AttributeName": "companyId", "KeyType": "HASH"}],
        AttributeDefinitions=[
            {"AttributeName": "companyId", "AttributeType": "S"},
            {"AttributeName": "verificationStatus", "AttributeType": "S"},
            {"AttributeName": "createdAt", "AttributeType": "S"},
        ],
        GlobalSecondaryIndexes=[
            {
                "IndexName": "VerificationStatusIndex",
                "KeySchema": [
                    {"AttributeName": "verificationStatus", "KeyType": "HASH"},
                    {"AttributeName": "createdAt", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            }
        ],
        **on_demand,
    )

    ddb.create_table(
        TableName="test-jobs",
        KeySchema=[{"AttributeName": "jobId", "KeyType": "HASH"}],
        AttributeDefinitions=[
            {"AttributeName": "jobId", "AttributeType": "S"},
            {"AttributeName": "companyId", "AttributeType": "S"},
            {"AttributeName": "postingStatus", "AttributeType": "S"},
            {"AttributeName": "opportunityType", "AttributeType": "S"},
            {"AttributeName": "createdAt", "AttributeType": "S"},
        ],
        GlobalSecondaryIndexes=[
            {
                "IndexName": "CompanyIndex",
                "KeySchema": [
                    {"AttributeName": "companyId", "KeyType": "HASH"},
                    {"AttributeName": "createdAt", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "PostingStatusIndex",
                "KeySchema": [
                    {"AttributeName": "postingStatus", "KeyType": "HASH"},
                    {"AttributeName": "createdAt", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "OpportunityTypeIndex",
                "KeySchema": [
                    {"AttributeName": "opportunityType", "KeyType": "HASH"},
                    {"AttributeName": "createdAt", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
        ],
        **on_demand,
    )

    ddb.create_table(
        TableName="test-applications",
        KeySchema=[{"AttributeName": "applicationId", "KeyType": "HASH"}],
        AttributeDefinitions=[
            {"AttributeName": "applicationId", "AttributeType": "S"},
            {"AttributeName": "applicantId", "AttributeType": "S"},
            {"AttributeName": "jobId", "AttributeType": "S"},
            {"AttributeName": "companyId", "AttributeType": "S"},
            {"AttributeName": "applicantJobKey", "AttributeType": "S"},
            {"AttributeName": "appliedAt", "AttributeType": "S"},
            {"AttributeName": "nextInterviewAt", "AttributeType": "S"},
        ],
        GlobalSecondaryIndexes=[
            {
                "IndexName": "ApplicantIndex",
                "KeySchema": [
                    {"AttributeName": "applicantId", "KeyType": "HASH"},
                    {"AttributeName": "appliedAt", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "JobIndex",
                "KeySchema": [
                    {"AttributeName": "jobId", "KeyType": "HASH"},
                    {"AttributeName": "appliedAt", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "ApplicantJobIndex",
                "KeySchema": [{"AttributeName": "applicantJobKey", "KeyType": "HASH"}],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "CompanyInterviewIndex",
                "KeySchema": [
                    {"AttributeName": "companyId", "KeyType": "HASH"},
                    {"AttributeName": "nextInterviewAt", "KeyType": "RANGE"},
                ],
                "Projection": {
                    "ProjectionType": "INCLUDE",
                    "NonKeyAttributes": [
                        "jobId",
                        "applicantId",
                        "status",
                        "nextInterview",
                    ],
                },
            },
        ],
        **on_demand,
    )

    ddb.create_table(
        TableName="test-notifications",
        KeySchema=[
            {"AttributeName": "userId", "KeyType": "HASH"},
            {"AttributeName": "createdAt", "KeyType": "RANGE"},
        ],
        AttributeDefinitions=[
            {"AttributeName": "userId", "AttributeType": "S"},
            {"AttributeName": "createdAt", "AttributeType": "S"},
        ],
        **on_demand,
    )


@pytest.fixture
def aws(monkeypatch):
    """A whole AWS world for one test, torn down afterwards."""
    with mock_aws():
        _clear_cached_clients()

        ddb = boto3.client("dynamodb", region_name=REGION)
        _create_tables(ddb)

        boto3.client("s3", region_name=REGION).create_bucket(Bucket="test-documents")

        sqs = boto3.client("sqs", region_name=REGION)
        queue_url = sqs.create_queue(QueueName="test-submissions")["QueueUrl"]

        sns = boto3.client("sns", region_name=REGION)
        topic_arn = sns.create_topic(Name="test-alerts")["TopicArn"]

        # SES refuses an unverified sender, so the identity is verified here and
        # the email path is genuinely exercised rather than silently swallowed.
        boto3.client("ses", region_name=REGION).verify_email_identity(
            EmailAddress="no-reply@example.com"
        )

        from common import config

        monkeypatch.setattr(config, "SUBMISSION_QUEUE_URL", queue_url)
        monkeypatch.setattr(config, "RECRUITER_TOPIC_ARN", topic_arn)

        yield {"queueUrl": queue_url, "topicArn": topic_arn}

        _clear_cached_clients()


# ----------------------------------------------------------------------
# Event helpers
# ----------------------------------------------------------------------
def event(
    method: str,
    resource: str,
    *,
    user: str = "",
    groups=(),
    email_address: str = "",
    body=None,
    path=None,
    query=None,
    name: str = "",
):
    """An API Gateway proxy event shaped the way the real one arrives.

    The claims live under requestContext.authorizer.claims, which is the only
    place any handler reads identity from.
    """
    request_context = {}
    if user:
        request_context = {
            "authorizer": {
                "claims": {
                    "sub": user,
                    "email": email_address or f"{user}@example.com",
                    "name": name or user,
                    "cognito:groups": ",".join(groups),
                }
            }
        }
    import json

    return {
        "httpMethod": method,
        "resource": resource,
        "path": resource,
        "pathParameters": path or None,
        "queryStringParameters": query or None,
        "headers": {"origin": "http://localhost:3000"},
        "body": json.dumps(body) if body is not None else None,
        "requestContext": request_context,
    }


def call(handler, *args, **kwargs):
    """Invokes a handler and returns the status code with the parsed body."""
    import json

    response = handler(event(*args, **kwargs), None)
    return response["statusCode"], json.loads(response["body"])


def pytest_collection_modifyitems(items):
    """Marks everything in a test_integration_ file, so the two layers can be
    run separately: `-m "not integration"` is the fast pass that needs no moto.
    """
    for item in items:
        if "test_integration_" in item.nodeid:
            item.add_marker(pytest.mark.integration)
