# Lucidchart prompts for the architecture diagrams

Paste each prompt into Lucidchart's AI diagram generator (Lucid AI, "Generate
diagram"). Every prompt describes the system as deployed in October 2026:
stacks `jiat-dev-persistence` and `jiat-dev-application` in AWS account
400294419066, region us-east-1, and the frontend on AWS Amplify Hosting.

Prompt 1 is the main architecture diagram. Prompts 2 to 4 are focused views
for slides or the SRS appendix. Prompt 5 restyles whatever the generator
produced.

## 1. Full system architecture

```
Create an AWS cloud architecture diagram for "Offerline", a serverless job and
internship application tracker. Use official AWS architecture icons and group
the resources into labelled boundaries. Flow left to right.

Outside AWS, on the left:
- Three user icons: "Applicant", "Recruiter (company account)", "Admin".
- A "GitHub repository" icon connected to AWS Amplify Hosting with the label
  "push to main triggers build".

Boundary "AWS Amplify Hosting (separate AWS account)":
- "Offerline web app (React + Vite SPA)". All three users connect to it over
  HTTPS.

Boundary "AWS Cloud, us-east-1, account 400294419066". Inside it, two nested
boundaries.

Nested boundary "Persistence stack (jiat-dev-persistence, retained data)":
- Amazon Cognito "User pool" with three groups listed: Applicants,
  Recruiters, Admins. Optional Google identity provider shown as a dashed
  external icon connected to it.
- AWS Lambda "Identity trigger" attached to the user pool, label "post
  confirmation and pre token generation: assigns the group".
- Amazon DynamoDB tables, each as its own icon:
  "Users",
  "Companies (index: VerificationStatusIndex)",
  "Jobs (indexes: CompanyIndex, PostingStatusIndex, OpportunityTypeIndex)",
  "Applications (indexes: ApplicantIndex, JobIndex, ApplicantJobIndex,
   CompanyInterviewIndex; stream enabled)",
  "Notifications (TTL)".
- Amazon S3 "Documents bucket (private, encrypted; CVs, letters, exports;
  exports expire after 7 days)".

Nested boundary "Application stack (jiat-dev-application, safe to redeploy)":
- Amazon API Gateway "REST API (40 routes)" with a Cognito authorizer badge,
  label "public routes: posting list and detail, company profile".
- Six AWS Lambda functions in a column: "auth-service", "company-service",
  "jobs-service", "application-service", "notification-service",
  "processor-service".
- Amazon SQS "Submission queue" with a smaller Amazon SQS "Dead letter queue
  (after 3 attempts)" attached below it.
- Amazon SNS "Recruiter alerts topic (one subscription per verified company,
  filtered on companyId)".
- Amazon EventBridge "Hourly schedule: expire postings".
- Amazon SES "Applicant email".
- Amazon CloudWatch "Logs" shown small in a corner, connected to all Lambda
  functions with a thin dashed line.

Connections:
1. Offerline web app -> Amazon Cognito: "sign up / sign in (SRP)".
2. Offerline web app -> API Gateway: "HTTPS + JWT".
3. API Gateway -> Cognito: "authorizer validates token".
4. API Gateway -> each of auth-service, company-service, jobs-service,
   application-service.
5. Those four functions -> DynamoDB tables: "read / write".
6. application-service and company-service -> S3: "presigned upload and
   download URLs".
7. Offerline web app -> S3: "direct upload with presigned PUT" (dashed).
8. application-service -> Submission queue: "new application".
9. Submission queue -> processor-service: "batch of 5".
10. EventBridge hourly schedule -> processor-service.
11. processor-service -> Jobs and Applications tables.
12. Applications table stream -> notification-service: "status and interview
    changes".
13. notification-service -> SES -> "Applicant" (email with calendar file).
14. notification-service -> SNS topic -> "Recruiter" (email alert).
15. notification-service -> Notifications table: "in-app notification
    centre".
16. Cognito -> Identity trigger -> Users table.

Add a small legend: solid arrow = synchronous request, dashed arrow =
asynchronous or event-driven.
```

## 2. Request path for one API call

```
Create a left-to-right sequence-style flow diagram titled "One request through
Offerline". Use AWS icons. Steps:
1. "Recruiter's browser (Amplify-hosted SPA)" sends "GET /jobs/{id}/applications
   with Cognito JWT".
2. "Amazon API Gateway" checks the token with "Amazon Cognito authorizer".
3. If invalid: arrow back to the browser labelled "401".
4. If valid: API Gateway invokes "AWS Lambda: jobs-service".
5. jobs-service checks "caller owns this posting" (decision diamond; no ->
   "403 Forbidden").
6. jobs-service queries "DynamoDB Applications table, JobIndex" and batch reads
   "DynamoDB Users table".
7. jobs-service returns "200 JSON with CORS header naming the caller's origin"
   to API Gateway, then to the browser.
Show the CORS note as a callout: "Only http://localhost:3000 and the Amplify
URL are allowed origins".
```

## 3. Event-driven notifications

```
Create an event-driven architecture diagram titled "How Offerline notifies
people". Use AWS icons, flow top to bottom.
Top: "Recruiter changes an application status or books an interview round" ->
"AWS Lambda: application-service / jobs-service" -> "Amazon DynamoDB:
Applications table".
Middle: "DynamoDB Stream (new and old images)" -> "AWS Lambda:
notification-service" with a note "retries 3 times, bisects a failing batch".
Bottom, three branches out of notification-service:
- "Amazon SES" -> "Applicant inbox: status email or interview invitation with
  .ics calendar file".
- "Amazon SNS: Recruiter alerts topic (filter policy on companyId)" ->
  "Recruiter inbox".
- "Amazon DynamoDB: Notifications table (TTL)" -> "In-app notification bell".
Side note box: "Notifications follow the stream, not the request, so a failed
email can never undo a status change that was already saved."
```

## 4. Application submission pipeline

```
Create a flow diagram titled "Submitting an application". Use AWS icons, left
to right.
1. "Applicant's browser" -> "API Gateway: POST /applications/upload-url" ->
   "AWS Lambda: application-service" returns "presigned S3 URL".
2. "Applicant's browser" -> "Amazon S3 documents bucket": "PUT the CV directly"
   (dashed).
3. "Applicant's browser" -> "API Gateway: POST /applications" ->
   "application-service" -> "DynamoDB Applications table (status SUBMITTED)".
4. application-service -> "Amazon SQS: Submission queue".
5. "Amazon SQS" -> "AWS Lambda: processor-service" (batch of 5, 10 second
   window). Failed messages after 3 attempts -> "Amazon SQS: Dead letter
   queue".
6. Separately, "Amazon EventBridge: every hour" -> "processor-service" ->
   "DynamoDB Jobs table: close postings past their deadline (EXPIRED)".
```

## 5. Styling pass

Run this after generating any of the above, or apply it by hand.

```
Restyle this diagram: white background, AWS service icons in their official
colours, group boundaries with 1px grey borders and 8px rounded corners,
boundary titles in dark green #2a6a52, arrows in dark grey, asynchronous
arrows dashed. Use Inter or a similar sans serif for all labels, 12pt for
labels and 16pt bold for the title. Keep generous spacing so no labels
overlap.
```

## Facts to check against the drawing

- 6 domain Lambda functions plus the identity trigger, 7 in total.
- 5 DynamoDB tables. The Applications stream drives notifications.
- 40 API routes; anonymous browsing works on the posting list and detail
  and on a company's public profile.
- SES is the applicant channel and SNS the recruiter channel, so no event
  is sent twice.
- The frontend is hosted on Amplify in a separate AWS account; the backend
  allows its origin through CORS and lists it as a Cognito callback URL.
