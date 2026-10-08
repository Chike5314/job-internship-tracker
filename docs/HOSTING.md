# Hosting the frontend on AWS Amplify

The SRS keeps Amplify Hosting out of CDK (section 2.5), so the app is connected
by hand in the console. Everything the console needs is below, in the order it
has to happen.

The ordering matters for one reason: the app's public URL does not exist until
Amplify has created it, and three pieces of backend configuration need that URL.
So the app is created first, then the backend is pointed at it, then the site is
rebuilt.

## What breaks without step 4

`allowedOrigins` in `cdk.json` is currently `["http://localhost:3000"]`, and that
one list feeds three separate things:

| It sets | Where | What fails on Amplify without it |
|---|---|---|
| Cognito callback and logout URLs | `persistence_stack.py`, `callback_urls` | Google sign-in is rejected with a redirect mismatch |
| API Gateway CORS | the REST API | every API call from the deployed site |
| S3 documents bucket CORS | the documents bucket | every CV, transcript and letter upload |

All three are one change, in step 4.

## 1. Commit the build spec

`amplify.yml` goes at the **repository root**, not in `frontend/`. It uses the
monorepo form (`appRoot: frontend`) so Amplify runs the build from inside the
frontend folder while still watching the whole repo.

## 2. Create the app in the Amplify console

1. Amplify console, **Create new app**, **Deploy app**, choose **GitHub**, and
   authorise the repository.
2. Pick the repository and the branch you want to host.
3. Amplify should detect `amplify.yml` at the root and show the monorepo build
   settings. If it asks, confirm the app root is `frontend`.
4. Do **not** start the first build until step 3 is done, because the build
   bakes the environment variables in and will fail without them.

## 3. Set the environment variables

App settings, **Environment variables**. All five are required: `env.ts`
validates them at module load and throws, so a missing one is a blank page
rather than a subtle bug.

```
VITE_API_BASE_URL              https://ng6nuspkv4.execute-api.us-east-1.amazonaws.com/dev
VITE_AWS_REGION                us-east-1
VITE_COGNITO_USER_POOL_ID      us-east-1_Ap5NRVKQQ
VITE_COGNITO_USER_POOL_CLIENT_ID  69rj3fq3e7cfbluutol0jbktgo
VITE_COGNITO_DOMAIN            jiat-dev.auth.us-east-1.amazoncognito.com
```

These are the dev values from `frontend/.env.example`. None of them is a secret:
the app client has no client secret, and all of these are visible in any browser
that loads the app. They are build-time values, baked into the bundle, so
changing one later needs a fresh build, not just a restart.

Then run the first build. It will give you a URL of the form
`https://<branch>.<appid>.amplifyapp.com`.

## 4. Point the backend at that URL

Add the Amplify URL to `allowedOrigins` in `cdk.json`, keeping localhost so
local development still works:

```json
"allowedOrigins": [
  "http://localhost:3000",
  "https://<branch>.<appid>.amplifyapp.com"
],
```

Then redeploy the backend:

```
cdk deploy --all
```

This updates the Cognito callback and logout URLs, the API's CORS and the
documents bucket's CORS in one pass.

## 5. Add the SPA rewrite

Without this, the site works until somebody refreshes on `/dashboard` or opens a
link to `/applications/abc`, and then S3 is asked for a file that does not exist
and returns 403. React Router needs every unknown path served `index.html`.

App settings, **Rewrites and redirects**, open the JSON editor and add:

```json
[
  {
    "source": "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>",
    "target": "/index.html",
    "status": "200",
    "condition": null
  }
]
```

This is AWS's own SPA rule. The regular expression rewrites paths without a file
extension and leaves real assets alone, so the JS, CSS, fonts, the icon sprite
and the source maps are still served as themselves.

## 6. Check the Google redirect URI

Google redirects back to the Cognito hosted UI, not to the app, so the app's new
URL does not go in the Google console. The authorised redirect URI there should
be:

```
https://jiat-dev.auth.us-east-1.amazoncognito.com/oauth2/idpresponse
```

If Google sign-in already works on localhost, this is already correct and needs
no change.

## 7. Verify on the deployed site

In this order, because each one proves a different piece of step 4:

1. Load the site. A blank page means a missing environment variable.
2. Open `/postings` directly in the address bar and refresh. A 403 means the
   rewrite in step 5 is missing or wrong.
3. Sign in with email. A CORS error in the console means the API origin did not
   take.
4. Sign in with Google. A redirect mismatch means the Cognito callback URL did
   not take.
5. Upload a CV. A CORS failure here means the bucket origin did not take.

## Worth deciding before you go live

`vite.config.ts` sets `build.sourcemap: true`, which publishes readable source
alongside the bundle. That is useful while this is a dev deployment and a
reviewer may want to read it. Turn it off for anything public-facing.
