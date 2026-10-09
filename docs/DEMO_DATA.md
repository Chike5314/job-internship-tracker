# Demo data to enter by hand

A complete, Cameroon-based data set for the live demo: one company, three
postings, three applicants with documents. Everything is fictional. Enter it
through the hosted site the evening before; about 30 minutes.

The documents are ready in [`docs/demo-files/`](demo-files/). To make them
again: `python scripts/make_demo_files.py`.

## Email addresses

Every account needs an inbox, because sign-up sends a confirmation code.
Use one Gmail address with a `+tag`; Gmail delivers all of them to the same
inbox, and each counts as a different account here:

| Account | Use |
| --- | --- |
| `yourname+mountainview@gmail.com` | The company |
| `yourname+brenda@gmail.com` | Brenda Ngwa, applies live on stage |
| `yourname+emmanuel@gmail.com` | Emmanuel Tabe, applied beforehand |
| `yourname+mirabel@gmail.com` | Mirabel Fon, applied beforehand |

Replace `yourname` with your own Gmail name. Pick one password for all four
and keep it off the slides.

## Order to enter it in

1. Sign up the company (section 1), then sign in as **admin** and verify it:
   Companies, find Mountainview Digital Labs, Verify. A company cannot publish
   until it is verified.
2. As the company, create and publish the three postings (section 2).
3. Sign up the three applicants and fill in their profiles (section 3).
4. Emmanuel and Mirabel apply now (section 4). Brenda does not: she applies
   live on stage.
5. As the company, open Emmanuel's application (it moves to Under review),
   and schedule him an interview for the day of the demo, 10:00, 45 minutes,
   online. Leave Mirabel's unopened, so the board shows a New card.

## 1. The company

Sign up, choose **Company**.

| Field | Value |
| --- | --- |
| Company name | Mountainview Digital Labs |
| Contact email | `yourname+mountainview@gmail.com` |
| Website | `https://mountainview-digital.example` |
| Office address | Molyko, Buea, South West Region, Cameroon |
| Phone | +237 6 70 00 00 01 |

Description, for the company profile:

> Mountainview Digital Labs builds web and cloud software for schools, clinics
> and small businesses across Cameroon. Our team of twelve works from Buea and
> Douala, and every year we train interns in cloud engineering, data and
> communication.

## 2. Three postings

Create each with **New posting**. Leave the documents list as the type suggests
unless the table says otherwise.

### Cloud Engineering Intern

| Field | Value |
| --- | --- |
| Posting title | Cloud Engineering Intern |
| Opportunity type | Academic internship |
| Where the work happens | On site |
| City, country | Buea, Cameroon |
| Experience | Entry |
| Openings | 2 |
| Duration | 3 months |
| Application deadline | 30 days from today |
| Salary | Disclosed, XAF 60,000 to 80,000 per month |
| Skills | Python, Linux, AWS, Git |
| Documents applicants send | CV, Cover letter, Academic transcript, School authorisation letter |

The role:

> Join our cloud team in Molyko and help run the services behind our school
> management platform. You will deploy small services on AWS, write scripts
> that keep them healthy, and document what you build. An engineer will mentor
> you every day, and your university supervisor will receive a report at the end.

### Junior Data Analyst

| Field | Value |
| --- | --- |
| Posting title | Junior Data Analyst |
| Opportunity type | Full-time job |
| Where the work happens | Hybrid |
| City, country | Douala, Cameroon |
| Experience | Entry |
| Openings | 1 |
| Application deadline | 30 days from today |
| Salary | Disclosed, XAF 250,000 to 350,000 per month |
| Skills | SQL, Excel, Power BI, Python |
| Documents applicants send | CV, Cover letter |

The role:

> Turn our clients' data into clear reports. You will clean data, build
> dashboards in Power BI and present findings to clinic and school managers in
> Douala. Two days a week from home after your first month.

### Marketing and Communications Intern

| Field | Value |
| --- | --- |
| Posting title | Marketing and Communications Intern |
| Opportunity type | Professional internship |
| Where the work happens | Remote |
| City, country | Yaounde, Cameroon |
| Experience | Entry |
| Openings | 1 |
| Duration | 6 months |
| Application deadline | 30 days from today |
| Salary | Disclosed, XAF 50,000 per month |
| Skills | Content writing, Social media, Canva, French |
| Documents applicants send | CV, Cover letter, Portfolio links (text) |

The role:

> Help us tell schools and clinics across Cameroon what our software does.
> You will write posts in English and French, design simple visuals and keep
> our pages active. Fully remote, with a weekly call with the team.

## 3. Three applicants

Sign up, choose **Applicant**, then fill in **Profile**.

| Field | Brenda Ngwa | Emmanuel Tabe | Mirabel Fon |
| --- | --- | --- | --- |
| Email | `yourname+brenda@gmail.com` | `yourname+emmanuel@gmail.com` | `yourname+mirabel@gmail.com` |
| Phone | +237 6 70 00 00 11 | +237 6 70 00 00 12 | +237 6 70 00 00 13 |
| School | University of Buea | University of Douala | University of Yaounde II |
| Field of study | Computer Science | Statistics and Economics | Communication |
| Degree level | Bachelors | Bachelors | Bachelors |
| Skills | Python, Linux, AWS, Git | SQL, Excel, Power BI, Python | Content writing, Canva, Social media, French |
| CV to upload | `CV_Ngwa_Brenda.pdf` | `CV_Tabe_Emmanuel.pdf` | `CV_Fon_Mirabel.pdf` |

Upload each CV under **CVs and documents**, so it is offered from the library
when they apply.

## 4. Applications

| Applicant | Posting | Documents | When |
| --- | --- | --- | --- |
| Emmanuel Tabe | Junior Data Analyst | CV from library, cover letter below | The evening before |
| Mirabel Fon | Marketing and Communications Intern | CV from library, cover letter below, portfolio `https://mirabel-portfolio.example` | The evening before |
| Brenda Ngwa | Cloud Engineering Intern | CV, cover letter, `Transcript_Ngwa_Brenda.pdf`, `School_Authorisation_Ngwa_Brenda.pdf` | Live on stage |

Cover letters, to paste:

**Emmanuel Tabe:**

> I graduated in Statistics and Economics from the University of Douala and
> spent last year building weekly reports for a microfinance office. I enjoy
> finding the one number a manager needs, and I would like to do that for your
> clients in Douala.

**Mirabel Fon:**

> I study Communication at the University of Yaounde II and run the social media
> pages of my student association in English and French. I would love to help
> schools and clinics understand what Mountainview's software can do for them.

**Brenda Ngwa** (on stage):

> I am a final year Computer Science student at the University of Buea. I have
> used AWS in my cloud computing course and built a timetable app for my
> department. I would like to spend my academic internship learning how a real
> team runs services in the cloud.

## What the board looks like on the day

| Posting | Before the demo | During the demo |
| --- | --- | --- |
| Cloud Engineering Intern | Empty | Brenda applies; the company opens it, then extends an offer; she accepts |
| Junior Data Analyst | Emmanuel, Interview booked for today | Mark the round complete if asked about interview rounds |
| Marketing and Communications Intern | Mirabel, New | Open it to show it moving to Under review |
