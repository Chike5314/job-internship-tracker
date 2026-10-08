# Offerline: Job and Internship Application Tracker

Read this file first. It is the working memory for this repository and it is
written for an assistant picking the project up with no prior conversation.

Serverless AWS backend. AWS CDK in Python, Lambda handlers in Python 3.12.
Product brand name is Offerline. Positioning line: "Opportunity, organized.
Success, accelerated." Tagline: "Real Opportunities. Right Here."

Governing document: the Software Requirements Specification. Two copies exist,
both in the folder above this repository:

- `Job_Internship_Tracker_SRS_v1.5.docx` is the working copy, 46 pages. This is
  the authority. Requirement identifiers in code comments, such as FR-5.2, refer
  to it.
- `Job_Internship_Tracker_SRS_Submission_v1.2.docx` is a condensed 9 page copy
  for academic submission. Both must be kept in step when a requirement changes.

## Status

The backend is feature complete against the SRS and is deployed to a
development account: AWS account `400294419066`, region `us-east-1`, stacks
`jiat-dev-persistence` and `jiat-dev-application`. `scripts/seed.py` has run
against it twice, confirming idempotency, and populated it with a verified
company, three published postings, two applicants with CVs, and five
applications spread across the pipeline including one scheduled interview.
Everything has been verified by `cdk synth` and by 99 tests.

Cognito hosted UI: `https://jiat-dev.auth.us-east-1.amazoncognito.com`. The app
client only allows the authorization code OAuth flow with callback
`http://localhost:3000` (no frontend listens there yet, so after sign in the
`code` has to be read out of the failed redirect URL and exchanged by hand at
`/oauth2/token`). The app client also only allows `ALLOW_USER_SRP_AUTH`, which
is why `scripts/seed.py` signs in through `pycognito` rather than
`USER_PASSWORD_AUTH`.

**This is the project's recurring bug, and it has now landed four times.** A
route that the frontend calls but the stack never declared does not fail
loudly. API Gateway matches the request against whatever resource it does have,
so `GET /companies/mine` silently became `GET /companies/{id}` with an id of
"mine", answered by a public route that can never see its caller, while
`GET /jobs/mine/{id}` matched nothing and returned 403 with a message about
authentication. From a browser both read as "the backend is not sending data".
The four that were missing, `GET /companies/mine`, `GET /jobs/mine/{id}`,
`POST /companies/logo-upload-url` and `POST /profile/cvs`, now exist.
`tests/test_route_surface.py` compares every `http.*` call in `frontend/src/api`
against the route table in `application_stack.py` and fails on a mismatch, so
the next one is caught in the suite rather than in somebody's browser. It ranks
a literal segment above a path parameter, the way API Gateway does, which is
exactly the distinction that hid `/companies/mine`.

First deploy also surfaced one real bug, now fixed: `GET /jobs` carries no
Cognito authorizer (`AuthorizationType.NONE`), since anonymous browsing has to
work, and a route with no authorizer attached never gets
`requestContext.authorizer.claims` populated by API Gateway no matter what a
client sends. The `mine=true` query flag that used to live on that route could
therefore never see a signed in caller. Fixed by splitting a separate,
authorizer-protected `GET /jobs/mine` off from the public `GET /jobs`. Worth
checking whether the same public-route-with-an-optional-caller pattern exists
anywhere else before it bites again (`POST /companies` reads a caller the same
way and is also `public=True` in the route table).

## Layout

```
app.py                     CDK entry point
infrastructure/
  config.py                deployment settings read from CDK context
  persistence_stack.py     tables, documents bucket, Cognito pool, identity trigger
  application_stack.py     Lambda functions, REST API, queues, topics, schedules
src/common/                shared code, described in README.md
src/handlers/              six domain functions plus the Cognito trigger
tests/                     unit tests and moto backed integration tests
scripts/seed.py            demo and dev data, safe to run more than once
frontend/                  React + Vite SPA, applicant experience so far, see below
docs/writing-conventions.md    how everything in this project is written
docs/brand/                design tokens and logo files, the frontend's source of truth
```

## Frontend

`frontend/` is a React 19 + Vite + TypeScript SPA, not yet a separate repo (see
`frontend/README.md` if one exists, otherwise this section). Applicant
experience only so far: sign up and sign in through custom branded forms
(`aws-amplify`'s Auth module, since the app client only allows
`ALLOW_USER_SRP_AUTH`), browse and filter postings, apply through a form
rendered entirely from a posting's `documentRequirements`, track applications,
respond to offers and interviews, edit a `SUBMITTED` application, manage a
profile and CV library, and notifications.

The company app is under `features/company/`: overview, postings, the posting
editor, a per-posting pipeline board with a reject bin, the interview calendar,
analytics, the company profile, and the applicants directory. That last one is
the only recruiter view organised by person rather than by posting, which is
what makes a repeat applicant visible at all; it is a two-pane list and detail
like the applicant side's applications page, with the selected person in the
path so a candidate is a link somebody can send.

Design tokens are generated, not hand authored: `frontend/scripts/build-tokens.mjs`
reads `docs/brand/tokens.json` directly and writes `frontend/src/styles/tokens.css`,
which is committed. Changing the design system means editing `tokens.json` and
re-running `npm run tokens` (or just `npm run dev`, which runs it first).

To run it: `cd frontend && npm install`, copy `.env.example` to `.env.local`
(already carries the dev deployment's values), then `npm run dev`. **Must run
on port 3000**: the deployed API's CORS and the documents bucket's CORS rule
are both scoped to exactly `http://localhost:3000`, and `strictPort: true` in
`vite.config.ts` is what stops Vite from silently moving to 3001 and turning
every API call into a confusing CORS failure. Seeded test accounts (from
`scripts/seed.py`, password `SeedData!2026` for both): `amara.nwosu@example.com`
and `diego.santos@example.com`.

Two things worth knowing before touching this code again:

- **`useReducer`'s lazy initializer only runs once.** `useApplyForm` derives its
  starting state from `requirements` and `cvs`, but React hooks can't be
  called conditionally, so it has to be called before a page's loading guard
  can return early. If the CVs query hasn't resolved yet on that first call,
  the initializer freezes on an empty CV list forever, even after the real
  data arrives. Fixed on `ApplyPage` by splitting the data-loading shell from
  the actual form (`ApplyFormPanel`), which only mounts once every query it
  depends on has resolved. Any future hook whose one-time initial state
  depends on query data needs the same split, not a loading spinner placed
  after the hook call.
- **A row that lays itself out against the viewport will be wrong here.** The
  applicants list is the whole page below the split and a little over half of it
  above, so its width does not follow the window's: a 900px window gives a wider
  list than a 1200px one, where the detail pane opens beside it. `ApplicantRow`
  is sized with `@container applicant-list` against `.rows` instead. Any other
  component that lives in one pane of a split needs the same treatment, and a
  media query will look right at the width you test and wrong at the next one.
- **A CSS Module cannot use a keyframe defined in a global stylesheet, and
  fails silently when it tries.** CSS Modules rewrites every `animation-name`
  into the module's hashed namespace, so `animation: m3-rise ...` in a
  `.module.css` compiles to `_m3-rise_<hash>_1`, while `@keyframes m3-rise` in
  the global `styles/m3.css` keeps its plain name. Nothing matches, nothing
  errors, and the element simply never moves. Every load-time entrance on the
  landing page and the auth screen was dead this way, including the hero, and
  it was only found by asking the browser for `getAnimations()` and getting an
  empty list back. `:global()` is rejected by this toolchain in both the
  `animation` shorthand and `animation-name`, so a module that needs a keyframe
  declares it in that module. The scroll-driven animations in the same file
  always worked because their keyframes are local. Before trusting any new
  animation, check `getAnimations().length` on the element rather than reading
  `animationName`, which is populated whether or not the keyframes exist.
- **A CSS Modules import to a file that doesn't exist is invisible to
  `tsc`.** Vite's ambient types accept any `*.module.css` path whether or not
  it's actually on disk; only the bundler catches a missing one, at dev or
  build time, not typecheck. Caught once this way (`LandingPage.module.css`)
  during verification, not before.

## What is built

- Two CDK stacks split by whether a resource holds data that cannot be
  recreated. `persistence_stack.py` retains everything outside development;
  `application_stack.py` is safe to destroy and redeploy.
- Five DynamoDB tables with the indexes from SRS section 4, the Applications
  stream, the Notifications TTL.
- Private documents bucket with encryption and an exports lifecycle rule.
- Cognito user pool, three groups, optional Google identity provider.
- SQS submission queue with a dead letter queue at three attempts, SNS recruiter
  topic, hourly posting expiry rule.
- Six domain Lambda functions and 39 REST routes behind a Cognito authorizer
  (all but a handful of public, anonymous-friendly ones, such as the posting
  listing and detail views and `GET /companies/{id}`).
- Identity trigger on the user pool. Post confirmation covers email and password
  sign up; pre token generation covers Google and writes the group into the token
  being issued. It lives in the persistence stack because attaching a trigger
  from the application stack is a CloudFormation cycle.
- Recruiter alerts end to end. Each verified company is subscribed to the one
  topic with a filter policy on its own `companyId`, removed again on suspension.
  SNS is the recruiter channel and SES is the applicant channel, so no event goes
  out twice.
- Admin capability: verify, reject, suspend, list by status, create a company
  account directly, and a platform overview. Moderation decisions append to a
  history rather than overwriting.
- Company interview calendar on a sparse GSI.
- 137 tests in two layers. 32 unit tests over the pure rules, 105 integration tests
  running the real handlers against moto with DynamoDB and its indexes, S3, SQS,
  SNS, SES and Cognito standing up in process.

```bash
pip install -r requirements-dev.txt
python -m pytest                        # everything, about 20 seconds
python -m pytest -m "not integration"   # fast pass, under a second
```

## Decisions that shape the code

Change any of these only deliberately. Each one was argued through and several
reverse an earlier approach.

- A recruiter account is the company. `companyId` is the Cognito subject
  identifier and there is no separate person record behind it.
- CVs are attached per application, because a person applying to different kinds
  of role needs a different CV for each. Every upload gets a new key and the ten
  most recent are offered for reuse. There is no default CV and no version chain.
- Storage is immutable; the application is not. An application stays editable
  while it is `SUBMITTED` and freezes the first time a recruiter opens it, which
  is a conditional write so two recruiters produce one history entry.
- Required documents come from the posting, never from the opportunity type. The
  type only pre fills a default set the recruiter then adjusts. A posting that
  drops the authorisation letter must accept applications without one.
- Notifications are driven by the Applications stream, not by the request, so a
  delivery failure cannot roll back a status change already written.
- Analytics are computed on read from `statusHistory`. There is no analytics
  store. SRS section 8.3 records when that would need revisiting.
- The company interview calendar is a sparse GSI. An application carries
  `nextInterviewAt` and a `nextInterview` snapshot only while it has an interview
  nothing has closed out, so rows enter and leave the index by themselves. Every
  place an interview or a status changes goes through `src/common/interviews.py`.
- Interviews run in rounds inside the one `INTERVIEW_SCHEDULED` status; there is
  no status per round. Each interview entry carries `round` and an optional
  `roundLabel`. One round is open at a time: the recruiter reschedules, cancels
  or marks it `COMPLETED` before the next is booked, and the next round is one
  past the last completed, so a declined round re-booked keeps its number. Only
  the first round writes a status history entry, so the funnel never counts the
  stage twice. The bulk status route refuses a move to interview; the board
  books several back to back through the single interview route instead.
- **The clock is not a writer.** Nothing runs on a timer in this system, so an
  interview whose time has simply passed still carries `nextInterviewAt`, with a
  value now in the past, and the application still says `INTERVIEW_SCHEDULED`.
  `GET /companies/{id}/interviews` therefore takes no lower bound unless one is
  asked for, and splits the result into `interviews` (ahead) and
  `awaitingOutcome` (passed, any age). A window starting at now dropped exactly
  the overdue ones, which left the overview counting an application at
  `INTERVIEW_SCHEDULED` while every interview screen showed nothing, with no way
  to find it. Any future query that filters on a stored timestamp against now
  has the same trap: ask what writes that field, and if the answer is "a user
  action", the field goes stale the moment they stop acting.
- The applicants directory is grouped on read, not stored. `GET
  /companies/{id}/applicants` walks `CompanyIndex` for the account's postings
  and `JobIndex` under each, then groups by `applicantId`, the same way
  `company_analytics` does and for the reason SRS 4.6 records. There is no
  person record behind an applicant beyond their Users row, so "the same
  person" means the same `applicantId` and nothing more. The profiles behind a
  page of rows are read with `dynamo.get_users`, a BatchGetItem, rather than one
  GetItem each; `_pipeline_row` takes the same batch so a board costs one read
  rather than one per card.
- How far somebody got is not where their newest application sits.
  `_furthest` ranks the five live stages and puts the three endings under all of
  them, so rejected on one posting and interviewing on another reads as
  interviewing. With nothing live it reports the ending the applicant chose over
  the one the company did.
- Deployment settings come from CDK context. Nothing is edited in source to
  deploy.

## Writing conventions

`docs/writing-conventions.md` governs every document, comment and piece of UI
copy. The two that get broken most often: no em dashes anywhere, and never frame
a feature against an alternative that only ever existed in a chat.

## The harness

`frontend/.harness` runs the whole SPA against fakes with no network. One rule
holds it together: every company route is answered from the same `applications`
array in `pipelineFake.ts`. Analytics used to be pre-seeded in `seed.ts` with an
empty funnel and a total that matched no board, so the overview said nothing was
waiting while the pipeline underneath it was full. A harness that can show two
screens agreeing when the real system has them disagreeing is worse than none,
so nothing company-facing is seeded with numbers of its own any more.

## Immediate next step

The seed script, the first deploy, and the applicant-facing frontend are all
done; see Status and Frontend above. The four SRS 7.2 runtime flows have now
been walked for real in a browser against the live API: sign in, document
upload (a real presigned S3 PUT), application submission, and status change
(an offer accepted, an interview confirmed), all verified with Playwright
during the build, not just asserted.

Two things left before the applicant side is really finished:

- **Amplify Hosting**, connected by hand to a GitHub-hosted frontend repo,
  per the manual steps below. Until then the frontend only runs locally.
- **Two things noted during frontend verification but not fixed**, since
  fixing them is backend work and this pass was scoped to the frontend:
  `GET /jobs/{id}` can never see a signed in caller for the same reason
  `GET /jobs/mine` couldn't before it was split out (`public=True` means no
  authorizer, ever, regardless of what token is sent), so a closed or expired
  posting 403s even the applicant who already applied to it. Still open.

  The CV library entry is now fixed: `POST /profile/cvs` records it after the
  upload lands and checks the object is really in the bucket first, so an
  abandoned upload no longer leaves an entry pointing at nothing. Asking for a
  presigned URL records nothing at all. Confirming the same key twice returns
  the same entry, because a browser retrying an upload it is unsure about is
  the normal case.

After that: recruiter and admin frontend phases, then the remaining Appendix D
diagrams.

## Where first deploy problems are expected

- **The pre token generation trigger.** The claims override shape is fiddly and a
  mistake there means every request is a 403 with nothing obviously wrong in the
  logs. Check `src/handlers/identity_service/handler.py` first if that happens.
- **Presigned PUT uploads.** If the browser sends a `Content-Type` that differs
  from the one the URL was signed with, S3 rejects it and it reads like a
  permissions problem.
- **SES in sandbox mode.** Anything to an unverified address fails silently and
  looks like the notification pipeline is broken when it is not. Verify the
  sender and any test recipient first.
- **Google federation.** Needs the Google console work before it can be tested at
  all. The stack skips the provider when the context values are empty, so a first
  deploy works without it.
- **The S3 bucket name** includes the account id but the Cognito domain prefix
  does not, so the domain prefix is the one that can collide globally.

## Manual steps after the first deploy

- Amplify Hosting is connected to the frontend repository by hand through the
  console. It must not be moved into CDK.
- Admin accounts are created in the Cognito console and added to the `Admins`
  group. Nothing in the code can write that group.
- Every verified company must follow the SNS confirmation link before alerts
  reach its inbox. The notification centre record is written either way.

## Still to do beyond the backend

- Recruiter and admin frontend views. The applicant view is done (see
  Frontend above); the design system, tokens and logo files it uses are the
  same ones a recruiter or admin view would use, already proven out.
- Remaining Appendix D diagrams: class, sequence, state machine, activity,
  deployment, component. The use case diagram, the ER diagram and data flow
  diagrams at levels 0, 1 and 2 are done and were delivered as SVG and PNG.
- One open question left on the table: whether an admin should be able to suspend
  an applicant account, and whether an admin should be able to edit the content of
  a posting rather than only close it. Both are currently out of scope.

## A note on the frontend contract

The sign up form must write `custom:accountType` as either `individual` or
`company`. The identity trigger reads it to decide the group, and anything it
does not recognise becomes an applicant. `frontend/src/auth/authApi.ts`'s
`signUpApplicant` already does this for the applicant side, always explicitly,
never inferred.
