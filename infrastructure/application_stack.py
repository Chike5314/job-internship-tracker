"""Compute and messaging.

Six domain Lambda functions behind one REST API, the submission queue and its
dead letter queue, the recruiter alert topic, the stream consumer that drives
notifications, and the scheduled rule that expires postings. Everything here can
be destroyed and redeployed without losing data.
"""
import aws_cdk as cdk
from aws_cdk import (
    aws_apigateway as apigateway,
    aws_events as events,
    aws_events_targets as targets,
    aws_iam as iam,
    aws_lambda as lambda_,
    aws_lambda_event_sources as event_sources,
    aws_logs as logs,
    aws_sns as sns,
    aws_sqs as sqs,
)
from constructs import Construct

from infrastructure.config import Config
from infrastructure.persistence_stack import PersistenceStack

RUNTIME = lambda_.Runtime.PYTHON_3_12


class ApplicationStack(cdk.Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        config: Config,
        persistence: PersistenceStack,
        **kwargs,
    ):
        super().__init__(scope, construct_id, **kwargs)
        self.config = config
        self.persistence = persistence

        # ------------------------------------------------------------------
        # Messaging
        # ------------------------------------------------------------------
        self.submission_dlq = sqs.Queue(
            self,
            "SubmissionDlq",
            queue_name=f"{config.prefix}-submissions-dlq",
            retention_period=cdk.Duration.days(14),
            enforce_ssl=True,
        )

        # FR-8.4. Three attempts, then the message is kept for inspection rather
        # than dropped, so a submission is never lost.
        self.submission_queue = sqs.Queue(
            self,
            "SubmissionQueue",
            queue_name=f"{config.prefix}-submissions",
            visibility_timeout=cdk.Duration.seconds(180),
            retention_period=cdk.Duration.days(4),
            enforce_ssl=True,
            dead_letter_queue=sqs.DeadLetterQueue(
                max_receive_count=3, queue=self.submission_dlq
            ),
        )

        self.recruiter_topic = sns.Topic(
            self,
            "RecruiterAlertTopic",
            topic_name=f"{config.prefix}-recruiter-alerts",
            display_name="New application alerts",
        )

        # ------------------------------------------------------------------
        # Shared function configuration
        # ------------------------------------------------------------------
        code = lambda_.Code.from_asset("src")

        common_env = {
            "STAGE": config.stage,
            "USERS_TABLE": persistence.users_table.table_name,
            "COMPANIES_TABLE": persistence.companies_table.table_name,
            "JOBS_TABLE": persistence.jobs_table.table_name,
            "APPLICATIONS_TABLE": persistence.applications_table.table_name,
            "NOTIFICATIONS_TABLE": persistence.notifications_table.table_name,
            "DOCUMENTS_BUCKET": persistence.documents_bucket.bucket_name,
            "SUBMISSION_QUEUE_URL": self.submission_queue.queue_url,
            "RECRUITER_TOPIC_ARN": self.recruiter_topic.topic_arn,
            "SENDER_EMAIL": config.sender_email,
            "USER_POOL_ID": persistence.user_pool.user_pool_id,
            "PARSING_SECRET_ARN": persistence.parsing_secret.secret_arn,
            "ALLOWED_ORIGINS": ",".join(config.allowed_origins),
            "POWERTOOLS_LOG_LEVEL": "INFO" if config.is_production else "DEBUG",
        }

        def make_function(
            name: str, handler: str, *, timeout_seconds: int = 30, memory: int = 512
        ) -> lambda_.Function:
            function_name = f"{config.prefix}-{name}"
            log_group = logs.LogGroup(
                self,
                f"{name}-logs",
                log_group_name=f"/aws/lambda/{function_name}",
                retention=logs.RetentionDays.ONE_MONTH,
                removal_policy=cdk.RemovalPolicy.DESTROY,
            )
            return lambda_.Function(
                self,
                name,
                function_name=function_name,
                runtime=RUNTIME,
                code=code,
                handler=handler,
                memory_size=memory,
                timeout=cdk.Duration.seconds(timeout_seconds),
                environment=dict(common_env),
                log_group=log_group,
                tracing=lambda_.Tracing.ACTIVE,
            )

        self.auth_fn = make_function(
            "auth-service", "handlers.auth_service.handler.lambda_handler"
        )
        self.company_fn = make_function(
            "company-service", "handlers.company_service.handler.lambda_handler"
        )
        self.jobs_fn = make_function(
            "jobs-service", "handlers.jobs_service.handler.lambda_handler",
            timeout_seconds=60,
        )
        self.application_fn = make_function(
            "application-service", "handlers.application_service.handler.lambda_handler"
        )
        self.notification_fn = make_function(
            "notification-service",
            "handlers.notification_service.handler.lambda_handler",
            timeout_seconds=60,
        )
        self.processor_fn = make_function(
            "processor-service",
            "handlers.processor_service.handler.lambda_handler",
            timeout_seconds=120,
            memory=1024,
        )

        api_functions = [
            self.auth_fn,
            self.company_fn,
            self.jobs_fn,
            self.application_fn,
            self.notification_fn,
        ]

        # ------------------------------------------------------------------
        # Permissions, granted narrowly per function
        # ------------------------------------------------------------------
        users = persistence.users_table
        companies = persistence.companies_table
        jobs = persistence.jobs_table
        applications = persistence.applications_table
        notifications = persistence.notifications_table
        bucket = persistence.documents_bucket

        users.grant_read_write_data(self.auth_fn)
        companies.grant_read_write_data(self.auth_fn)
        bucket.grant_put(self.auth_fn)
        bucket.grant_read(self.auth_fn)

        companies.grant_read_write_data(self.company_fn)
        jobs.grant_read_write_data(self.company_fn)
        users.grant_read_data(self.company_fn)
        notifications.grant_read_write_data(self.company_fn)
        applications.grant_read_data(self.company_fn)
        # Managing each company's filtered subscription to the alert topic, and
        # creating a recruiter account when an admin onboards a company by hand.
        self.recruiter_topic.grant_publish(self.company_fn)
        self.company_fn.add_to_role_policy(
            iam.PolicyStatement(
                actions=["sns:Subscribe", "sns:Unsubscribe"],
                resources=[self.recruiter_topic.topic_arn],
            )
        )
        self.company_fn.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "cognito-idp:AdminCreateUser",
                    "cognito-idp:AdminAddUserToGroup",
                    "cognito-idp:AdminDeleteUser",
                ],
                resources=[persistence.user_pool.user_pool_arn],
            )
        )

        jobs.grant_read_write_data(self.jobs_fn)
        companies.grant_read_data(self.jobs_fn)
        applications.grant_read_write_data(self.jobs_fn)
        users.grant_read_data(self.jobs_fn)
        bucket.grant_put(self.jobs_fn)
        bucket.grant_read(self.jobs_fn)

        applications.grant_read_write_data(self.application_fn)
        jobs.grant_read_data(self.application_fn)
        companies.grant_read_data(self.application_fn)
        users.grant_read_write_data(self.application_fn)
        bucket.grant_put(self.application_fn)
        bucket.grant_read(self.application_fn)
        self.submission_queue.grant_send_messages(self.application_fn)

        notifications.grant_read_write_data(self.notification_fn)
        self.recruiter_topic.grant_publish(self.notification_fn)
        applications.grant_read_data(self.notification_fn)
        jobs.grant_read_data(self.notification_fn)
        companies.grant_read_data(self.notification_fn)
        users.grant_read_data(self.notification_fn)

        applications.grant_read_write_data(self.processor_fn)
        jobs.grant_read_write_data(self.processor_fn)
        companies.grant_read_data(self.processor_fn)
        users.grant_read_data(self.processor_fn)
        notifications.grant_read_write_data(self.processor_fn)
        bucket.grant_read(self.processor_fn)
        self.recruiter_topic.grant_publish(self.processor_fn)
        persistence.parsing_secret.grant_read(self.processor_fn)

        # SES has no resource level grant helper, so the send permissions are
        # attached directly. Sending is restricted to the configured identity.
        ses_policy = iam.PolicyStatement(
            actions=["ses:SendEmail", "ses:SendRawEmail"],
            resources=["*"],
            conditions={"StringEquals": {"ses:FromAddress": config.sender_email}},
        )
        for fn in (self.notification_fn, self.processor_fn, self.company_fn):
            fn.add_to_role_policy(ses_policy)

        # ------------------------------------------------------------------
        # Event sources
        # ------------------------------------------------------------------
        # FR-8.1 and FR-12.1. Notifications are driven by the stream rather than
        # by the request, so a delivery failure cannot roll back a recorded
        # status change.
        self.notification_fn.add_event_source(
            event_sources.DynamoEventSource(
                applications,
                starting_position=lambda_.StartingPosition.TRIM_HORIZON,
                batch_size=10,
                bisect_batch_on_error=True,
                retry_attempts=3,
                report_batch_item_failures=True,
            )
        )

        # FR-5.9. The processor consumes submissions on its own schedule.
        self.processor_fn.add_event_source(
            event_sources.SqsEventSource(
                self.submission_queue,
                batch_size=5,
                max_batching_window=cdk.Duration.seconds(10),
                report_batch_item_failures=True,
            )
        )

        # FR-4.5. Postings past their deadline are closed once an hour.
        events.Rule(
            self,
            "PostingExpiryRule",
            rule_name=f"{config.prefix}-posting-expiry",
            description="Transitions postings past their applicationDeadline to EXPIRED.",
            schedule=events.Schedule.rate(cdk.Duration.hours(1)),
            targets=[
                targets.LambdaFunction(
                    self.processor_fn,
                    event=events.RuleTargetInput.from_object({"task": "EXPIRE_POSTINGS"}),
                )
            ],
        )

        # ------------------------------------------------------------------
        # REST API
        # ------------------------------------------------------------------
        self.api = apigateway.RestApi(
            self,
            "RestApi",
            rest_api_name=f"{config.prefix}-api",
            description="Job and Internship Application Tracker REST API.",
            deploy_options=apigateway.StageOptions(
                stage_name=config.stage,
                throttling_rate_limit=100,
                throttling_burst_limit=200,
                metrics_enabled=True,
                logging_level=apigateway.MethodLoggingLevel.ERROR,
                tracing_enabled=True,
            ),
            default_cors_preflight_options=apigateway.CorsOptions(
                allow_origins=config.allowed_origins,
                allow_methods=apigateway.Cors.ALL_METHODS,
                allow_headers=[
                    "Content-Type",
                    "Authorization",
                    "X-Amz-Date",
                    "X-Api-Key",
                ],
                max_age=cdk.Duration.hours(1),
            ),
            cloud_watch_role=True,
        )

        authorizer = apigateway.CognitoUserPoolsAuthorizer(
            self,
            "CognitoAuthorizer",
            authorizer_name=f"{config.prefix}-authorizer",
            cognito_user_pools=[persistence.user_pool],
            identity_source="method.request.header.Authorization",
        )

        integrations = {fn.node.id: apigateway.LambdaIntegration(fn) for fn in api_functions}

        def route(path: str, method: str, fn: lambda_.Function, *, public: bool = False):
            resource = self.api.root
            for part in [p for p in path.strip("/").split("/") if p]:
                existing = resource.get_resource(part)
                resource = existing if existing else resource.add_resource(part)
            resource.add_method(
                method,
                integrations[fn.node.id],
                authorizer=None if public else authorizer,
                authorization_type=(
                    apigateway.AuthorizationType.NONE
                    if public
                    else apigateway.AuthorizationType.COGNITO
                ),
            )

        # Profile and CV library
        route("/profile", "GET", self.auth_fn)
        route("/profile", "POST", self.auth_fn)
        route("/profile/upload-url", "POST", self.auth_fn)
        route("/profile/cvs", "GET", self.auth_fn)
        route("/profile/cvs", "POST", self.auth_fn)

        # Companies and admin moderation
        route("/companies", "POST", self.company_fn, public=True)
        route("/companies", "GET", self.company_fn)
        # Literal segments, so they resolve ahead of /companies/{id}. That
        # route is public and therefore blind to its caller, which is the
        # whole reason these exist separately.
        route("/companies/mine", "GET", self.company_fn)
        route("/companies/logo-upload-url", "POST", self.company_fn)
        route("/companies/{id}", "GET", self.company_fn, public=True)
        route("/companies/{id}", "PATCH", self.company_fn)
        route("/companies/{id}/status", "PATCH", self.company_fn)
        route("/admin/companies", "POST", self.company_fn)
        route("/admin/overview", "GET", self.company_fn)

        # Postings
        route("/jobs", "GET", self.jobs_fn, public=True)
        route("/jobs", "POST", self.jobs_fn)
        route("/jobs/mine", "GET", self.jobs_fn)
        route("/jobs/mine/{id}", "GET", self.jobs_fn)
        route("/jobs/{id}", "GET", self.jobs_fn, public=True)
        route("/jobs/{id}/applied", "GET", self.jobs_fn)
        route("/jobs/{id}", "PATCH", self.jobs_fn)
        route("/jobs/{id}/applications", "GET", self.jobs_fn)
        route("/jobs/{id}/applications/bulk-status", "PATCH", self.jobs_fn)
        route("/jobs/{id}/analytics", "GET", self.jobs_fn)
        route("/companies/{id}/analytics", "GET", self.jobs_fn)
        route("/companies/{id}/interviews", "GET", self.jobs_fn)
        route("/companies/{id}/applicants", "GET", self.jobs_fn)
        route("/companies/{id}/export", "POST", self.jobs_fn)

        # Applications
        route("/applications", "POST", self.application_fn)
        route("/applications/upload-url", "POST", self.application_fn)
        route("/applications/me", "GET", self.application_fn)
        route("/applications/{id}", "GET", self.application_fn)
        route("/applications/{id}", "PATCH", self.application_fn)
        route("/applications/{id}/status", "PATCH", self.application_fn)
        route("/applications/{id}/reinstate", "POST", self.application_fn)
        route("/applications/{id}/interview", "POST", self.application_fn)
        route("/applications/{id}/interview", "PATCH", self.application_fn)

        # Notification centre
        route("/notifications", "GET", self.notification_fn)
        route("/notifications/read-all", "PATCH", self.notification_fn)
        route("/notifications/{id}/read", "PATCH", self.notification_fn)

        cdk.CfnOutput(self, "ApiUrl", value=self.api.url)
        cdk.CfnOutput(self, "SubmissionQueueUrl", value=self.submission_queue.queue_url)
        cdk.CfnOutput(self, "RecruiterTopicArn", value=self.recruiter_topic.topic_arn)
