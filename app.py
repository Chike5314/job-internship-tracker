#!/usr/bin/env python3
"""CDK entry point for the Job and Internship Application Tracker.

Two stacks are deployed. The persistence stack holds everything that cannot be
recreated from source, so every resource in it is retained on delete. The
application stack holds the compute and messaging layer, which is safe to tear
down and redeploy at any time.
"""
import os

import aws_cdk as cdk

from infrastructure.config import Config
from infrastructure.persistence_stack import PersistenceStack
from infrastructure.application_stack import ApplicationStack

app = cdk.App()

config = Config.from_context(app)

env = cdk.Environment(
    account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
    region=os.environ.get("CDK_DEFAULT_REGION", config.region),
)

persistence = PersistenceStack(
    app,
    f"{config.prefix}-persistence",
    config=config,
    env=env,
    description="Durable resources: DynamoDB tables, documents bucket, Cognito user pool.",
)

application = ApplicationStack(
    app,
    f"{config.prefix}-application",
    config=config,
    persistence=persistence,
    env=env,
    description="Lambda handlers, REST API, queues, topics and scheduled rules.",
)

# The application stack reads table, bucket and user pool references from the
# persistence stack, so CloudFormation already orders the two correctly.

cdk.Tags.of(app).add("Project", "job-internship-tracker")
cdk.Tags.of(app).add("Environment", config.stage)

app.synth()
