# Offerline live demo: walkthrough guide

The main flow: **an applicant applies, a recruiter reviews and interviews,
the recruiter makes an offer, the applicant accepts.**

## The 8 minute showcase

For the Digisol presentation to staff and interns from other departments.
Slides take about five minutes; the live part is three. Prepare as in
section 1 below, with the applicant and recruiter windows side by side.

| When | Slide or screen | Say |
| --- | --- | --- |
| 0:00 | Cover, The problem, How we approached it | The pain, then one answer to each |
| 2:00 | What we built, Built on AWS | Both sides of one record; AWS services as jobs, not jargon |
| 4:00 | Live demo, applicant window | Open Robotics Software Engineer, Apply, pick the CV, upload a letter, Submit. "That file went straight into an encrypted S3 locker." |
| 5:00 | Recruiter window | Open the posting's pipeline, click the new card, then Full view. "Opening it moved it to Under review." |
| 5:45 | Applicant window | Status now Under review, and the bell lit up. "Nobody pressed send: the change triggered it." |
| 6:15 | Recruiter, then applicant | Extend offer; the applicant accepts it |
| 7:00 | What we learned, Thank you | AWS lessons, applied; questions |

If a step fails on stage, go back to the slides: the What we built slide shows
both screens. Everything after this section is the full 12 to 15 minute version,
with the console tour, for a technical audience or for questions.

The full version below names the AWS services behind each step, so the demo
doubles as the architecture explanation.

## 1. The day before

### Load the demo data

The seed script fills the dev deployment through the real API, the same way a
browser would. It is safe to run more than once.

1. Sign in to the hosted site with your admin account, open the browser's
   developer tools, and copy the ID token (Application tab, Local Storage, the
   key ending in `.idToken`). Admin accounts are created by hand in the Cognito
   console; nothing in the app can make one.
2. From the project folder, with the `.venv` active:

```bash
python scripts/seed.py --api-url https://ng6nuspkv4.execute-api.us-east-1.amazonaws.com/dev --admin-token <paste the ID token> --demo
```

ID tokens expire after an hour, so copy a fresh one if it is refused.

What it leaves behind:

| Account | Password | Use it for |
| --- | --- | --- |
| `acme.robotics@example.com` | the seed password | The recruiter: Acme Robotics, verified |
| `demo.applicant@example.com` | the seed password | The applicant you apply as on stage: has a CV, no applications |
| `amara.nwosu@example.com`, `diego.santos@example.com` | the seed password | Applicants with history, if asked |
| your admin account | your own | The admin screens |

The seed password is the `--password` default in `scripts/seed.py`. Every
account uses an `example.com` address, so none of them receives real email.

On the **Backend Engineer** board there are now applications in every stage:
three New (Brice, Joel, Awa), three Under review (Clarisse, Kwame, and Diego
from the base seed), and Serge Akono between interview rounds with a
"Technical" round two booked. **Robotics Software Engineer** has no
applications yet; that is the one you apply to live.

### Check the deployment

- Open https://main.dshlqks1zd51k.amplifyapp.com and sign in once as each
  account, which also warms up the Lambda functions so nothing is slow on stage.
- If the browser console shows a CORS error, the Amplify URL in `cdk.json` does
  not match the site; see "Immediate next step" in `CLAUDE.md`.
- Try Continue with Google once if you plan to show it.

### Open these tabs, in this order

1. **Applicant** window: the hosted site, signed in as `demo.applicant@example.com`.
2. **Recruiter** window, a separate browser profile or a private window: the
   hosted site, signed in as `acme.robotics@example.com`.
3. **AWS console**, us-east-1, account 400294419066:
   - DynamoDB, table `jiat-dev-applications`, Explore items
   - S3, bucket `jiat-dev-documents-400294419066`, folder `applications/`
   - CloudWatch, Log groups, `/aws/lambda/jiat-dev-notification-service`
   - Cognito, user pool `jiat-dev`, Users

Two browser windows side by side on one screen shows both people at once and
makes the notifications visible as they happen.

## 2. The walkthrough

### Step 1. The problem, in one sentence (30 seconds)

> Applying for work is scattered: postings you cannot trust, every role asking
> for different documents, and applications that go silent. Offerline puts the
> posting, the application and every decision on one record both sides can see.

### Step 2. Browse as a visitor (1 minute)

Sign out in the applicant window, or open a private one. Show the landing page,
then **Browse jobs**, then filter by Full-time job.

> This is a React app on **AWS Amplify Hosting**, built from GitHub on every
> push. The postings come through **API Gateway** to a **Lambda** function that
> reads **DynamoDB** through an index on posting status. These routes are
> public; there is no sign-in yet.

### Step 3. Sign in (30 seconds)

Sign in as `demo.applicant@example.com`.

> Sign-in is **Amazon Cognito**. The password never reaches our code; the
> browser proves it with SRP and gets a signed token. A Cognito trigger, itself
> a Lambda function, put this account in the Applicants group when it was
> created, and API Gateway checks that token on every private route.

Optional: point at Continue with Google, which is Cognito federating to Google.

### Step 4. Apply (2 minutes)

Open **Robotics Software Engineer**, then **Apply**.

- Point at the form: it asks for exactly what this posting listed.
- Choose the CV from the library. Upload a cover letter PDF.

> That upload did not go through our servers. The API handed the browser a
> short-lived **presigned S3 URL**, and the file went straight into a private,
> encrypted **S3** bucket.

Switch to the S3 tab, refresh `applications/`, and show the new object.

Submit.

> Submitting writes the application to **DynamoDB** and puts a message on an
> **SQS** queue. A processor function picks it up in batches; three failures
> would land it in a dead letter queue instead of losing it.

Show **My applications**: status Submitted.

### Step 5. The recruiter opens it (2 minutes)

In the recruiter window: **Postings**, then **Robotics Software Engineer**,
then **Pipeline**. The new card is in **New**.

Click the card. The drawer opens beside the board.

> Opening it moved it to Under review, and froze it: the applicant can no
> longer edit what the recruiter is reading.

Click **Full view**. Show the CV and cover letter reading in the page, and the
history on the right.

Now look at the applicant window: the status is Under review, and the bell
has a new notification.

> Nothing called the applicant. The status change was written to DynamoDB,
> the table's **stream** fired, and a notification function wrote the in-app
> notice and sent an email through **SES**, and an alert to the company's
> **SNS** topic. The email follows the saved data, so a failed delivery can
> never undo a decision.

Switch to the DynamoDB tab, open the application item, and show
`statusHistory`. Then CloudWatch: the newest log stream of the notification
function shows the event it handled.

### Step 6. Working a busy board (2 minutes)

Recruiter window: **Backend Engineer**, then **Pipeline**.

- **New** column: **Select all 3**, then **Move 3 to review**. One request, each
  application checked against the state model on its own.
- **Under review** column: **Select all**, then **Book N interviews**. Choose
  the same day and time as Serge's round two (open his card to see it). The
  board warns that the bookings clash with an interview already on the
  calendar. Click **Pick another time**, choose a free time, and book. They are
  booked back to back, each applicant with their own time and calendar file.

> Interviews are found through a sparse **DynamoDB** index that holds only
> applications with an interview still open, so the company calendar is one
> query.

### Step 7. Interview rounds and an offer (2 minutes)

Open **Serge Akono**, then **Full view**. Show Round 1 complete with its note,
and Round 2 (Technical) booked.

Back on the **Robotics Software Engineer** board, open the demo applicant's
card, then **Extend offer**, with a short note.

Applicant window: open the application. The offer is there. **Accept** it.

Recruiter window: the card moves to **Decided**, "Offer accepted".

> That is the whole pipeline: submitted, under review, interview, offer,
> accepted, each move checked by a state machine that refuses anything it does
> not list.

### Step 8. Behind the scenes (2 minutes)

Pick two or three, depending on time:

- **EventBridge**: rule `jiat-dev-posting-expiry`, every hour, closes postings
  past their deadline.
- **SQS**: `jiat-dev-submissions` and its dead letter queue.
- **CloudFormation**: two stacks from AWS CDK. `jiat-dev-persistence` holds the
  data and is retained; `jiat-dev-application` holds the code and can be torn
  down and redeployed freely.
- **IAM**: each Lambda function's role allows only the tables and actions it
  needs.

### Step 9. Admin, if asked (1 minute)

Sign in as the admin. **Overview**, then **Companies**: verify, reject or
suspend a company, each decision kept in a history. A company cannot publish
until it is verified.

## 3. If something goes wrong

| What you see | Why | What to do |
| --- | --- | --- |
| The first click is slow | A Lambda cold start | Expected after an idle spell; warm up beforehand |
| No email arrives | SES is in sandbox mode and the demo addresses are `example.com` | Show the in-app bell instead; say SES sending is a launch step |
| "This posting is no longer open" | The posting was closed, or passed its deadline | Closed: re-run the seed, which republishes it. Past its deadline: set a later deadline in the posting editor, then publish |
| A CORS error in the console | The Amplify URL changed | Update `allowedOrigins` in `cdk.json` and deploy both stacks |
| Sign-in token refused by the seed script | ID tokens last an hour | Copy a fresh one |
| Google sign-in fails | The Google client is missing the Cognito redirect URI | Use email sign-in on stage |

## 4. Questions you may be asked

- **Why serverless?** Traffic is spiky around deadlines; Lambda and DynamoDB
  scale with it and cost nothing when idle.
- **Why DynamoDB and not a relational database?** Every screen is a known
  query, served by an index; the stream drives notifications for free.
- **How are documents kept private?** A private, encrypted bucket, reached
  only through presigned links that expire in minutes.
- **What happens if email fails?** The status is already saved; the stream
  retries, and failures can be inspected without losing the change.
- **How is it deployed?** AWS CDK in Python, two stacks; the frontend on
  Amplify Hosting from GitHub.
- **How is it tested?** 153 automated backend tests run the real handlers
  against an in-process AWS stand-in.
