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
Everything has been verified by `cdk synth` and by 106 tests.

Cognito hosted UI: `https://jiat-dev.auth.us-east-1.amazoncognito.com`. The app
client only allows the authorization code OAuth flow with callback
`http://localhost:3000` (no frontend listens there yet, so after sign in the
`code` has to be read out of the failed redirect URL and exchanged by hand at
`/oauth2/token`). The app client also only allows `ALLOW_USER_SRP_AUTH`, which
is why `scripts/seed.py` signs in through `pycognito` rather than
`USER_PASSWORD_AUTH`.

### Public routes and the caller they cannot see

The one rule behind the shape of the route table. A route with no Cognito
authorizer attached never gets `requestContext.authorizer.claims` populated by
API Gateway, no matter what the client sends in the `Authorization` header. So a
handler behind a public route cannot tell who is calling, ever. Anonymous
browsing has to work, so some routes have to be public, and a route that also
needs to behave differently for a signed in caller gets an authorizer protected
counterpart of its own rather than trying to read an optional caller.

First deploy surfaced one instance: the `mine=true` query flag on `GET /jobs`
could never see a signed in caller, fixed by splitting `GET /jobs/mine` off.
A later sweep for the same pattern found three more, all now fixed:

- **`POST /companies` was dead.** It was `public=True` and called `get_caller`,
  the required one, so every call failed on the caller lookup. No recruiter could
  ever register a company through the deployed API. It is now authorizer
  protected, which is what it always needed to be: the record is keyed by the
  caller's Cognito subject, so there is no anonymous registration.
- **`GET /jobs/{id}`** read an optional caller to widen the response for an
  owner, an admin, or an applicant who had already applied. All three branches
  were unreachable, so a posting that was not published 403'd everyone including
  its own owner. It now serves the public view of a published posting and
  nothing else, with `GET /jobs/mine/{id}` as the owner and admin counterpart.
  An applicant reads a posting they applied to through `GET /applications/{id}`,
  which already carries the posting with it, and that is what satisfies FR-4.10.
- **`GET /companies/{id}`** widened its response the same way and equally never
  did. It now serves the public view only, with `GET /companies/mine` as the
  counterpart, since `GET /companies` is admin only and a recruiter otherwise had
  no authenticated way to read its own record.

`get_optional_caller` has been removed from `src/common/auth.py`, because
nothing can use it correctly here, and a comment there records why. The three
remaining public routes are `GET /jobs`, `GET /jobs/{id}` and
`GET /companies/{id}`, and none of them reads a caller.

The integration tests did not catch any of this, and would not have: they invoke
the handlers directly with a synthesised event carrying claims, so every one of
these routes looked authenticated in the suite. A route's `public` flag is the
only thing that decides, and it lives in `infrastructure/application_stack.py`.
Reading the synthesised template is how to check it:

```bash
npx aws-cdk synth --quiet -c env=dev
# then read AWS::ApiGateway::Method resources and their AuthorizationType
```

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

The company app lives under `/company` in `src/features/company/`, behind one
`RequireGroup("Recruiters")` on the shell rather than a guard per route. It uses
a left rail (`CompanyShell`, `CompanySidebar`) rather than the applicant side's
top bar, because a recruiter moves between seven destinations all day and an
applicant between three. Seven screens: Overview, Postings, the posting editor,
the pipeline board, Interviews, Analytics and Company profile. Admin views do
not exist yet.

Design tokens are generated, not hand authored: `frontend/scripts/build-tokens.mjs`
reads `docs/brand/tokens.json` directly and writes `frontend/src/styles/tokens.css`,
which is committed. Changing the design system means editing `tokens.json` and
re-running `npm run tokens` (or just `npm run dev`, which runs it first).

The two themes are called `paper` and `ink`, not light and dark. Every colour
token lives in `[data-theme='paper']` or `[data-theme='ink']` and none of them in
bare `:root`, so a page carrying any other value on that attribute renders with
no colours at all: white ground, invisible field edges. A blocking inline script
in `index.html` sets the attribute before the stylesheet loads, which is what
keeps that from happening in a browser. Anything driving the app from outside, a
screenshot harness above all, has to use `paper` or `ink`.

### The design source

There are two Offerline artifacts and they do different jobs.

- **Offerline**, a Design System, holds tokens, six components, the logo group
  and the brand book. Its `tokens.json` IS `docs/brand/tokens.json`: the two are
  the same file, and the frontend generates its CSS from it. It defines no
  screens at all.
- **Offerline, Product UI**, a Design canvas, holds eleven artboards and is where
  the screens live: a landing board, a brand kit, positioning, four applicant
  boards, three company boards and sign in.

The built applicant side follows the system but not the canvas: a top bar where
the canvas has a sidebar, no Dashboard screen, and one combined postings list
where the canvas separates Jobs from Internships. That gap is known and was left
deliberately. The company side and the landing page were built to the canvas.

### Looking at the company screens without a backend

They sit behind a recruiter guard and read a live API, so they cannot be seen by
running the app against nothing. A throwaway Vite harness rendered them against a
seeded query cache and a stubbed identity, which is how the layout and both
themes were actually looked at rather than asserted from a clean compile. It is
not committed; rebuild one when a screen needs looking at.

### The landing page

Built from `Main.dc.html`, all eight of its sections. The postings strip is the
real listing rather than a mock of one: it shares a query key with the browse
page, so arriving there afterwards costs no second request.

Two of the canvas's own section titles were changed, deliberately. "Hire as an
organisation, not as one inbox" framed the feature against an alternative that
only ever existed in a conversation, which `docs/writing-conventions.md`
forbids. "Every change is recorded. Nothing is overwritten" described the
engineering invariant rather than what the reader gets from it. They are now
"Post, shortlist and schedule in one place" and "You always know where it
stands".

Sections below the fold reveal on scroll. It is pure progressive enhancement:
CSS scroll-driven animations inside `@supports ((animation-timeline: view()) and
(animation-range: entry))` and `prefers-reduced-motion: no-preference`, with no
scroll-listener fallback, because a reader in Firefox losing a fade loses
nothing. Only `opacity` and `transform` are animated, and `animation-timeline` is
declared after the `animation` shorthand, which would otherwise reset it. The
hero and the strip under it never animate: the first screen is solid at rest.

### The company logo

`POST /companies/logo-upload-url` issues a presigned PUT under the company's own
prefix and records nothing. The client sends the key back on
`PATCH /companies/{id}` once the upload lands, which checks the key belongs to
that company and that an object is really there. Same two step shape as the CV
library, for the same reason. The key never leaves the API as a key: it comes
back as a presigned `logoUrl`. A logo change alone does not send a verified
company back for review, because the name and the website are what an admin
actually checked.

### The design pass

One pass over the applicant frontend, verified by a build, by the 23 frontend
tests, and by screenshots in both themes at 1280, 900, 760 and 390 wide:

- **Typefaces.** Fraunces for display and Inter for the interface, replacing
  Instrument Serif and Source Sans 3. Fraunces comes from its optical size
  subset (`@fontsource-variable/fraunces/opsz.css`) rather than the default
  weight only one, so one family carries a 76px headline and an 11px eyebrow.
  The italic file is imported alongside it because `display-italic` is a real
  style in the scale and without the file the browser slants the roman. A serif
  stays in the system because the logo's wordmark is a serif.
- **Logo.** `src/assets/brand/offerline-mark.svg` and `offerline-wordmark.svg`,
  both traced from the supplied artwork rather than redrawn;
  `docs/brand/logo/trace-wordmark.py` is how the second one was made. `Logo.tsx`
  inlines them with `?raw` instead of pointing an `img` at them: an SVG loaded
  through `img` is its own document, so `currentColor` inside it resolves to
  black and the wordmark stayed black on the dark panel. Inlined, the ink
  inherits and one file serves both themes. The four
  `offerline-*-{dark,light}.png` files still sitting in `src/assets/brand/` are
  the old bright blue mark and nothing imports them now.
- **Icons.** `public/icons.svg` is the 58 icon sprite, replacing a starter
  template's Bluesky and Discord leftovers. `src/ui/Icon.tsx` carries a union of
  every symbol name, so a misspelled icon fails typecheck rather than rendering
  as empty space.
- **Input edges.** `controls.module.css` drew its edge as an inset ring but never
  turned off the browser's own `2px inset` border, which the reset zeroes for
  `button` and nothing else, so every field wore a grey 3D bevel over the
  designed one. Fixed, with hover and focus states added.
- **`rule-strong`.** The token's own usage note says it must read at 3:1 and its
  value did not: `n-400` measures 1.85:1 against the field fill. Now `n-600`,
  which clears 3:1 against both the field and the page in either theme.
- **Split screen auth.** `AuthLayout.tsx` is two columns: the product on a fixed
  forest panel on the left, the form on paper on the right. The left column
  lists the four stages an application moves through, in the pipeline's own
  status vocabulary. Below 900px it becomes a band above the form and the
  wordmark moves into the form header. The bloom field is re-anchored to that
  panel and given the ink theme's bloom values in both themes; as written it is
  fixed to the viewport with shapes measured in `vw`, so left alone it washes
  across the form and drains the contrast out of every control there.

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
- Six domain Lambda functions and 33 REST routes behind a Cognito authorizer
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
- 106 tests in two layers. 30 unit tests over the pure rules, 76 integration tests
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
- A CV reaches the library only after its upload lands. `POST /profile/upload-url`
  hands out a presigned URL and records nothing; the client PUTs the file
  straight to S3 and then calls `POST /profile/cvs`, which checks the object is
  really there before writing the entry. Written at presign time, as it was
  before, the library filled with entries pointing at keys that had no object
  behind them, and the reuse list then offered CVs that could not be downloaded.
  Confirming twice is idempotent on the key, because a client retries. Both
  frontend sites that upload a CV do all three steps:
  `features/profile/useProfile.ts` and `features/apply/useApplyForm.ts`.
  `POST /applications/upload-url` never had this problem and writes nothing.
- The company interview calendar is a sparse GSI. An application carries
  `nextInterviewAt` and a `nextInterview` snapshot only while it has an interview
  still ahead of it, so rows enter and leave the index by themselves. Every place
  an interview or a status changes goes through `src/common/interviews.py`.
- Deployment settings come from CDK context. Nothing is edited in source to
  deploy.

## Writing conventions

`docs/writing-conventions.md` governs every document, comment and piece of UI
copy. The two that get broken most often: no em dashes anywhere, and never frame
a feature against an alternative that only ever existed in a chat.

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
Both of the issues noted during frontend verification are now fixed at the
source; see the public routes section above for the first, and the CV library
section below for the second.

After that: the admin frontend phase, then the remaining Appendix D diagrams. The new `GET /jobs/mine/{id}` and `GET /companies/mine` routes exist
for the recruiter views and have no caller yet; `POST /companies` is likewise
untouched by the applicant frontend, so recruiter registration has never been
exercised against the deployed API.

**The deployed dev stack is behind everything above until the next `cdk deploy`.**
The company routes, the company logo upload and the SQS consumer switch all exist
only in source. Recruiter registration has still never been exercised against the
deployed API, so the company app's first real run is also the first real test of
`POST /companies`.

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
