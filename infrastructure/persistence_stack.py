"""Durable resources.

Five DynamoDB tables, the documents bucket and the Cognito user pool. Nothing in
this stack can be rebuilt from source once it holds real data, so every resource
carries a retain removal policy outside development.
"""
from typing import Optional

import aws_cdk as cdk
from aws_cdk import (
    aws_cognito as cognito,
    aws_dynamodb as dynamodb,
    aws_iam as iam,
    aws_lambda as lambda_,
    aws_logs as logs,
    aws_s3 as s3,
    aws_secretsmanager as secretsmanager,
)
from constructs import Construct

from infrastructure.config import Config


class PersistenceStack(cdk.Stack):
    def __init__(self, scope: Construct, construct_id: str, *, config: Config, **kwargs):
        super().__init__(scope, construct_id, **kwargs)
        self.config = config

        removal = (
            cdk.RemovalPolicy.RETAIN if config.is_production else cdk.RemovalPolicy.DESTROY
        )

        # ------------------------------------------------------------------
        # Tables
        # ------------------------------------------------------------------
        self.users_table = dynamodb.Table(
            self,
            "UsersTable",
            table_name=f"{config.prefix}-users",
            partition_key=dynamodb.Attribute(
                name="userId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            point_in_time_recovery_specification=dynamodb.PointInTimeRecoverySpecification(
                point_in_time_recovery_enabled=True
            ),
            removal_policy=removal,
        )

        self.companies_table = dynamodb.Table(
            self,
            "CompaniesTable",
            table_name=f"{config.prefix}-companies",
            partition_key=dynamodb.Attribute(
                name="companyId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            point_in_time_recovery_specification=dynamodb.PointInTimeRecoverySpecification(
                point_in_time_recovery_enabled=True
            ),
            removal_policy=removal,
        )
        # Serves the admin moderation queue without a table scan.
        self.companies_table.add_global_secondary_index(
            index_name="VerificationStatusIndex",
            partition_key=dynamodb.Attribute(
                name="verificationStatus", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="createdAt", type=dynamodb.AttributeType.STRING
            ),
        )

        self.jobs_table = dynamodb.Table(
            self,
            "JobsTable",
            table_name=f"{config.prefix}-jobs",
            partition_key=dynamodb.Attribute(
                name="jobId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            point_in_time_recovery_specification=dynamodb.PointInTimeRecoverySpecification(
                point_in_time_recovery_enabled=True
            ),
            removal_policy=removal,
        )
        # Every posting belonging to one recruiter account.
        self.jobs_table.add_global_secondary_index(
            index_name="CompanyIndex",
            partition_key=dynamodb.Attribute(
                name="companyId", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="createdAt", type=dynamodb.AttributeType.STRING
            ),
        )
        # The public listing, newest first, filtered down in the handler.
        self.jobs_table.add_global_secondary_index(
            index_name="PostingStatusIndex",
            partition_key=dynamodb.Attribute(
                name="postingStatus", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="createdAt", type=dynamodb.AttributeType.STRING
            ),
        )
        # A listing already narrowed to one opportunity type.
        self.jobs_table.add_global_secondary_index(
            index_name="OpportunityTypeIndex",
            partition_key=dynamodb.Attribute(
                name="opportunityType", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="createdAt", type=dynamodb.AttributeType.STRING
            ),
        )

        self.applications_table = dynamodb.Table(
            self,
            "ApplicationsTable",
            table_name=f"{config.prefix}-applications",
            partition_key=dynamodb.Attribute(
                name="applicationId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            point_in_time_recovery_specification=dynamodb.PointInTimeRecoverySpecification(
                point_in_time_recovery_enabled=True
            ),
            # The stream is what drives every applicant notification. New and old
            # images are both needed so the consumer can tell what changed.
            stream=dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
            removal_policy=removal,
        )
        self.applications_table.add_global_secondary_index(
            index_name="ApplicantIndex",
            partition_key=dynamodb.Attribute(
                name="applicantId", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="appliedAt", type=dynamodb.AttributeType.STRING
            ),
        )
        self.applications_table.add_global_secondary_index(
            index_name="JobIndex",
            partition_key=dynamodb.Attribute(
                name="jobId", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="appliedAt", type=dynamodb.AttributeType.STRING
            ),
        )
        # Guards FR-5.3. A conditional put on this attribute is what actually
        # stops a second application to the same posting.
        self.applications_table.add_global_secondary_index(
            index_name="ApplicantJobIndex",
            partition_key=dynamodb.Attribute(
                name="applicantJobKey", type=dynamodb.AttributeType.STRING
            ),
        )
        # FR-13.8, the company interview calendar. Sparse on purpose: only an
        # application with an interview still ahead of it carries
        # nextInterviewAt, so a row enters the index when an interview is
        # scheduled and leaves when it is cancelled, declined, passes, or the
        # application reaches a final status. A company's calendar is one ranged
        # query rather than a walk across every posting.
        self.applications_table.add_global_secondary_index(
            index_name="CompanyInterviewIndex",
            partition_key=dynamodb.Attribute(
                name="companyId", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="nextInterviewAt", type=dynamodb.AttributeType.STRING
            ),
            # Only what a calendar row shows. Projecting the whole item would
            # copy the documents map and the status history into the index on
            # every write for no reader.
            projection_type=dynamodb.ProjectionType.INCLUDE,
            non_key_attributes=["jobId", "applicantId", "status", "nextInterview"],
        )

        self.notifications_table = dynamodb.Table(
            self,
            "NotificationsTable",
            table_name=f"{config.prefix}-notifications",
            partition_key=dynamodb.Attribute(
                name="userId", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="createdAt", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            time_to_live_attribute="expiresAt",
            removal_policy=removal,
        )

        # ------------------------------------------------------------------
        # Documents bucket
        # ------------------------------------------------------------------
        self.documents_bucket = s3.Bucket(
            self,
            "DocumentsBucket",
            bucket_name=f"{config.prefix}-documents-{self.account}",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            versioned=False,
            removal_policy=removal,
            auto_delete_objects=not config.is_production,
            cors=[
                s3.CorsRule(
                    allowed_methods=[s3.HttpMethods.PUT, s3.HttpMethods.GET],
                    allowed_origins=config.allowed_origins,
                    allowed_headers=["*"],
                    exposed_headers=["ETag"],
                    max_age=3000,
                )
            ],
            lifecycle_rules=[
                # Exports are a convenience artefact, not a record.
                s3.LifecycleRule(
                    id="expire-exports",
                    prefix="exports/",
                    expiration=cdk.Duration.days(7),
                )
            ],
        )

        # ------------------------------------------------------------------
        # Parsing credentials (SRS section 2.6 and open decision 8.1)
        # ------------------------------------------------------------------
        self.parsing_secret = secretsmanager.Secret(
            self,
            "DocumentParsingSecret",
            secret_name=f"{config.prefix}/document-parsing",
            description="Credentials used by the in house document parsing routine.",
            generate_secret_string=secretsmanager.SecretStringGenerator(
                secret_string_template='{"provider":"internal"}',
                generate_string_key="apiKey",
                exclude_punctuation=True,
            ),
            removal_policy=removal,
        )

        # ------------------------------------------------------------------
        # Cognito
        # ------------------------------------------------------------------
        self.user_pool = cognito.UserPool(
            self,
            "UserPool",
            user_pool_name=f"{config.prefix}-users",
            self_sign_up_enabled=True,
            sign_in_aliases=cognito.SignInAliases(email=True),
            auto_verify=cognito.AutoVerifiedAttrs(email=True),
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=False),
                fullname=cognito.StandardAttribute(required=False, mutable=True),
            ),
            custom_attributes={
                # Written at sign up by the frontend so that the post
                # confirmation trigger knows which group to place the account in.
                "accountType": cognito.StringAttribute(mutable=False, max_len=32),
                "companyName": cognito.StringAttribute(mutable=True, max_len=256),
            },
            password_policy=cognito.PasswordPolicy(
                min_length=10,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=False,
            ),
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
            removal_policy=removal,
        )

        # FR-1.2 and FR-1.3. Admin is created by hand, never by self service.
        for group_name, description, precedence in (
            ("Applicants", "Individuals applying to postings.", 30),
            ("Recruiters", "Verified company accounts publishing postings.", 20),
            ("Admins", "Platform operators who verify companies and moderate.", 10),
        ):
            cognito.CfnUserPoolGroup(
                self,
                f"{group_name}Group",
                user_pool_id=self.user_pool.user_pool_id,
                group_name=group_name,
                description=description,
                precedence=precedence,
            )

        self.google_provider: Optional[cognito.UserPoolIdentityProviderGoogle] = None
        if config.google_client_id and config.google_client_secret_arn:
            secret = secretsmanager.Secret.from_secret_complete_arn(
                self, "GoogleClientSecret", config.google_client_secret_arn
            )
            self.google_provider = cognito.UserPoolIdentityProviderGoogle(
                self,
                "GoogleProvider",
                user_pool=self.user_pool,
                client_id=config.google_client_id,
                client_secret_value=secret.secret_value,
                scopes=["openid", "email", "profile"],
                attribute_mapping=cognito.AttributeMapping(
                    email=cognito.ProviderAttribute.GOOGLE_EMAIL,
                    fullname=cognito.ProviderAttribute.GOOGLE_NAME,
                ),
            )

        supported = [cognito.UserPoolClientIdentityProvider.COGNITO]
        if self.google_provider is not None:
            supported.append(cognito.UserPoolClientIdentityProvider.GOOGLE)

        callback_urls = [o for o in config.allowed_origins if o != "*"] or [
            "http://localhost:3000"
        ]

        self.user_pool_client = self.user_pool.add_client(
            "WebClient",
            user_pool_client_name=f"{config.prefix}-web",
            auth_flows=cognito.AuthFlow(user_srp=True, user_password=False),
            o_auth=cognito.OAuthSettings(
                flows=cognito.OAuthFlows(authorization_code_grant=True),
                scopes=[
                    cognito.OAuthScope.OPENID,
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.PROFILE,
                ],
                callback_urls=callback_urls,
                logout_urls=callback_urls,
            ),
            supported_identity_providers=supported,
            prevent_user_existence_errors=True,
            access_token_validity=cdk.Duration.hours(1),
            id_token_validity=cdk.Duration.hours(1),
            refresh_token_validity=cdk.Duration.days(30),
        )
        if self.google_provider is not None:
            self.user_pool_client.node.add_dependency(self.google_provider)

        # ------------------------------------------------------------------
        # Group assignment trigger
        # ------------------------------------------------------------------
        # This function sits in the persistence stack rather than beside the other
        # handlers, because a trigger has to be attached to the pool and the pool
        # lives here. Attaching it from the application stack would make the pool
        # depend on that stack while that stack already depends on the pool, which
        # CloudFormation refuses as a cycle. It touches no table and holds no
        # state, so nothing about the durable boundary is weakened by it.
        identity_log_group = logs.LogGroup(
            self,
            "IdentityTriggerLogs",
            log_group_name=f"/aws/lambda/{config.prefix}-identity-trigger",
            retention=logs.RetentionDays.ONE_MONTH,
            removal_policy=cdk.RemovalPolicy.DESTROY,
        )
        self.identity_trigger = lambda_.Function(
            self,
            "IdentityTrigger",
            function_name=f"{config.prefix}-identity-trigger",
            runtime=lambda_.Runtime.PYTHON_3_12,
            code=lambda_.Code.from_asset("src"),
            handler="handlers.identity_service.handler.lambda_handler",
            memory_size=256,
            timeout=cdk.Duration.seconds(15),
            log_group=identity_log_group,
        )
        self.identity_trigger.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "cognito-idp:AdminListGroupsForUser",
                    "cognito-idp:AdminAddUserToGroup",
                ],
                # Scoped to pools in this account and region rather than to this
                # one pool. Naming the pool here would put its ARN in the role
                # policy while the pool itself already references the function as
                # a trigger, which is a cycle CloudFormation refuses. Two read
                # and write group actions in one account is a narrow enough
                # grant to accept in exchange for the deployment working.
                resources=[
                    f"arn:{self.partition}:cognito-idp:{self.region}:{self.account}:userpool/*"
                ],
            )
        )
        # Post confirmation covers the email and password path. Pre token
        # generation covers every path including Google, and writes the group
        # into the token being issued.
        self.user_pool.add_trigger(
            cognito.UserPoolOperation.POST_CONFIRMATION, self.identity_trigger
        )
        self.user_pool.add_trigger(
            cognito.UserPoolOperation.PRE_TOKEN_GENERATION, self.identity_trigger
        )

        if config.user_pool_domain_prefix:
            self.user_pool.add_domain(
                "HostedUiDomain",
                cognito_domain=cognito.CognitoDomainOptions(
                    domain_prefix=config.user_pool_domain_prefix
                ),
            )

        # ------------------------------------------------------------------
        # Outputs consumed by the frontend configuration
        # ------------------------------------------------------------------
        cdk.CfnOutput(self, "UserPoolId", value=self.user_pool.user_pool_id)
        cdk.CfnOutput(
            self, "UserPoolClientId", value=self.user_pool_client.user_pool_client_id
        )
        cdk.CfnOutput(self, "DocumentsBucketName", value=self.documents_bucket.bucket_name)
