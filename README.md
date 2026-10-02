# Job and Internship Application Tracker

A serverless application tracker for full time jobs, professional internships and
academic internships, built on AWS with the CDK in Python. This repository holds
the backend: the infrastructure definition and the Lambda handlers behind the
REST API. The frontend is a separate application hosted on Amplify.

The behaviour implemented here follows the Software Requirements Specification
version 1.3. Requirement identifiers such as FR-5.2 appear in the code comments
so that a reader can trace a rule back to the document that asked for it.

## Layout

```
app.py                     CDK entry point
infrastructure/
  config.py                deployment settings read from CDK context
  persistence_stack.py     tables, documents bucket, Cognito user pool
  application_stack.py     Lambda functions, REST API, queues, topics, schedules
src/
  common/                  shared code used by every handler
    access.py              record lookups and the ownership checks beside them
    alerts.py              recruiter alerts and the per company subscription
    auth.py                caller identity taken from the token claims
    cognito.py             the one place that creates an account
    documents.py           posting driven document requirements
    interviews.py          the fields that put an application on the calendar
    dynamo.py              table handles and query helpers
    email.py               SES sending and the iCalendar builder
    errors.py              the error contract returned to clients
    parsing.py             in house document text extraction
    responses.py           HTTP response shapes
    router.py              the small router each domain function dispatches with
    state_machine.py       the application status model
    storage.py             S3 keys and presigned URLs
    validation.py          payload validation
  handlers/
    auth_service/          profile and CV library
    company_service/       company accounts, admin moderation, admin onboarding
    identity_service/      the Cognito triggers that put an account in its group
    jobs_service/          postings, pipeline, analytics, bulk actions, export
    application_service/   submission, amendment, status, interviews
    notification_service/  notification centre and the Applications stream consumer
    processor_service/     queue consumer and the hourly posting expiry sweep
tests/                     tests for the rules that need no AWS
```

## Why two stacks

The split is by whether a resource holds data that cannot be recreated, not by
which AWS service it belongs to. `persistence_stack.py` holds the five DynamoDB
tables, the documents bucket and the Cognito user pool, all retained on delete
outside development. `application_stack.py` holds everything that can be torn
down and redeployed at any time. The dependency runs one way, which keeps the
cross stack references to a single boundary.

## Getting started

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt

cdk bootstrap                      # once per account and region
cdk deploy --all
```

Nothing has to be edited in source to deploy. Every setting is read from CDK
context, so a real deployment is:

```bash
cdk deploy --all \
  -c stage=prod \
  -c senderEmail=no-reply@your-domain.com \
  -c allowedOrigins=https://your-app.amplifyapp.com \
  -c googleClientId=... \
  -c googleClientSecretArn=arn:aws:secretsmanager:...
```

Google federation is skipped when either Google value is empty, so a first
deployment works before the Google console work is done. Email and password sign
in is unaffected.

## After the first deploy

Three things are done by hand, and each is by design.

Amplify Hosting is connected to the frontend repository through the console. It
is a one time action tied to a GitHub authorisation, and putting it in CDK would
make every stack deployment depend on that authorisation staying valid.

Admin accounts are created in the Cognito console and added to the `Admins`
group. There is no self service route to admin, which is FR-1.3, and nothing in
the code can write that group.

Every verified company has to follow the SNS confirmation link before application
alerts reach its inbox. That is how email subscriptions work rather than a fault,
and it is why a notification centre record is written for every event whether or
not the subscription exists.

The frontend sign up form has to write `custom:accountType` as either
`individual` or `company`. The identity trigger reads it to decide the group, and
anything it does not recognise becomes an applicant.

SES starts in sandbox mode. Verify the sender address and any test recipient,
and raise a production access request before real applicant traffic arrives.

## Tests

```bash
pip install -r requirements-dev.txt

python -m pytest                        # everything, about 20 seconds
python -m pytest -m "not integration"   # the fast pass, under a second
python -m pytest -m integration         # only the tests that stand up AWS
```

There are two layers. The fast pass covers the rules that are pure functions:
the application state model, the posting driven document requirements, the
payload validation, and the fields that put an application on the company
calendar.

The integration tests run the real handlers against moto, which stands up
DynamoDB with its indexes, S3, SQS, SNS, SES and Cognito inside the test process.
That is the layer that covers the things a unit test cannot reach: whether an
index is defined the way a query assumes, whether a conditional write actually
refuses a second application, whether a presigned URL comes back signed, and
whether an application really leaves the calendar when its interview is
cancelled.

No AWS credentials are needed and nothing reaches a real account. `conftest.py`
sets dummy credentials so boto3 cannot pick up a real profile from the machine.

A fixture builds a fresh world for each test, so the tests do not depend on the
order they run in. Every module caches its boto3 client for the life of a Lambda
container, so those caches are cleared between tests as well: a cached client
would otherwise hold a connection to the previous test's world.

## Notes worth knowing before reading the code

Documents never pass through Lambda. The browser asks for a presigned URL,
uploads straight to S3 and sends back only the object key, which is checked
against the caller before it is stored.

Nothing stored is ever written over. Every upload gets a fresh key, so a document
attached to a submitted application stays exactly as it was submitted. The
application record itself is a different matter: it stays editable while it is
in `SUBMITTED` and freezes the first time a recruiter opens it.

Required documents come from the posting, not from the opportunity type. The type
only pre fills a default set the recruiter then adjusts.

Notifications are driven by the Applications stream rather than by the request
that caused them, so a delivery failure has no way to undo a status change that
is already written.
