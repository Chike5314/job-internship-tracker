"""Deployment configuration.

Everything that changes between a development deployment and a real one is read
from CDK context so that no value has to be edited in source. Defaults are the
development values, so `cdk synth` works out of the box with nothing supplied.
"""
from dataclasses import dataclass, field
from typing import List, Optional

import aws_cdk as cdk


@dataclass(frozen=True)
class Config:
    stage: str = "dev"
    region: str = "us-east-1"

    # Sender address used by SES. Must be a verified identity while SES is in
    # sandbox mode, which is the state assumed in SRS section 2.6.
    sender_email: str = "no-reply@example.com"

    # Google OAuth credentials for the Cognito identity provider. When either is
    # empty the provider is skipped and the pool falls back to email and
    # password only, which keeps a first deployment possible before the Google
    # console work is done.
    google_client_id: str = ""
    google_client_secret_arn: str = ""

    # Origins allowed to call the REST API from a browser.
    allowed_origins: List[str] = field(default_factory=lambda: ["*"])

    # Cognito hosted UI domain prefix. Must be globally unique within a region.
    user_pool_domain_prefix: Optional[str] = None

    # Whether the submission queue's Lambda consumer is running.
    #
    # A Lambda event source mapping on an SQS queue long polls it around the
    # clock, so an idle queue still bills ReceiveMessage requests every minute of
    # every day. On a development account that is the whole of the free tier
    # spent on nothing: roughly 650,000 requests a month against an allowance of
    # a million, with no submissions at all. Turn it off between demos with
    # `-c submissionConsumer=off` and on again when the pipeline is being used.
    # Submissions still enqueue while it is off; they are processed once it comes
    # back, within the queue's four day retention.
    submission_consumer_enabled: bool = True

    @property
    def prefix(self) -> str:
        return f"jiat-{self.stage}"

    @property
    def is_production(self) -> bool:
        return self.stage == "prod"

    @classmethod
    def from_context(cls, app: cdk.App) -> "Config":
        def ctx(key: str, default):
            value = app.node.try_get_context(key)
            return default if value in (None, "") else value

        stage = ctx("stage", "dev")
        origins = ctx("allowedOrigins", ["*"])
        if isinstance(origins, str):
            origins = [o.strip() for o in origins.split(",") if o.strip()]

        return cls(
            stage=stage,
            region=ctx("region", "us-east-1"),
            sender_email=ctx("senderEmail", "no-reply@example.com"),
            google_client_id=ctx("googleClientId", ""),
            google_client_secret_arn=ctx("googleClientSecretArn", ""),
            allowed_origins=origins,
            user_pool_domain_prefix=ctx("userPoolDomainPrefix", f"jiat-{stage}"),
            submission_consumer_enabled=str(
                ctx("submissionConsumer", "on")
            ).strip().lower() not in ("off", "false", "0", "no"),
        )
