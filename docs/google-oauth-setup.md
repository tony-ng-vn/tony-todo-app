# Google Cloud OAuth setup for Gmail + Calendar

This is what you (not an agent) need to do in Google Cloud Console before Gmail/Calendar ingestion can be built and tested. Written 2026-07-14; verify current console UI yourself since Google changes it periodically.

## Important correction to earlier guidance

Earlier in this project's history, Gmail/Calendar integration was described as blocked on "an external, weeks-long CASA security assessment." That's only true if this app will be used by people beyond a small named list you control. **For a personal project where you are the only user, Google does not require verification or a CASA assessment at all** -- that requirement applies once an OAuth app moves out of "Testing" publish status to serve real external users past the ~100-test-user cap. As long as this stays in Testing mode with your own account added as a test user, you can request Gmail/Calendar scopes today, with no security review and no weeks-long wait. This section replaces that earlier framing.

## Step-by-step

1. **Create or select a Google Cloud project.** [console.cloud.google.com](https://console.cloud.google.com) -> project picker -> New Project. Any name is fine, e.g. "Thread Todo App".

2. **Enable the APIs.** APIs & Services -> Library -> enable:
   - Gmail API
   - Google Calendar API

3. **Configure the OAuth consent screen.** APIs & Services -> OAuth consent screen.
   - User type: **External** (unless this Google account is part of a Google Workspace org, in which case Internal is simpler and also skips verification entirely for org members).
   - App name, support email, developer contact: anything reasonable.
   - Scopes: add the ones actually needed --
     - `https://www.googleapis.com/auth/gmail.readonly` (read email for extraction)
     - `https://www.googleapis.com/auth/gmail.compose` (create drafts only -- **do not** add `gmail.send`; the app should never send mail directly per the PRD's autonomy model)
     - `https://www.googleapis.com/auth/calendar.readonly` (read meeting context)
   - **Publishing status: leave as "Testing."** Do not click "Publish App."
   - **Test users:** add your own Google account's email address here. Only accounts on this list can complete the OAuth flow while in Testing status.

4. **Create an OAuth 2.0 Client ID.** APIs & Services -> Credentials -> Create Credentials -> OAuth client ID.
   - Application type: **Web application**.
   - Authorized redirect URI: this needs to point at whatever callback endpoint gets built (an InsForge function, following the same pattern as `ingest-granola-loops` and `draft-follow-up`) -- something like `https://y26ze9je.us-east.insforge.app/functions/google-oauth-callback`. Confirm the exact URL once that function exists and is deployed; Google requires an exact match.
   - Save the **Client ID** and **Client Secret** it gives you.

5. **Store the credentials as InsForge secrets, not env vars.** Once you have them:
   ```
   npx @insforge/cli secrets add GOOGLE_OAUTH_CLIENT_ID "<value>"
   npx @insforge/cli secrets add GOOGLE_OAUTH_CLIENT_SECRET "<value>"
   ```
   Never put these in `VITE_`-prefixed variables -- they must stay server-side, same reasoning as `OPENROUTER_API_KEY` and `INGEST_FUNCTION_TOKEN`.

## What happens after this is done

Once the above exists, the actual integration work (an OAuth callback function, a Gmail-reading ingestion function mirroring `ingest-granola-loops.ts`'s structure, wiring `oauth_connections` for real) can be built and -- critically -- tested against your real Gmail account the same way the Granola integration was verified this session: real API calls, real data, checked in the browser, not just assumed to work from reading Google's docs. That's deliberately not done yet, because writing that code without the ability to test it against Google's actual API would ship with false confidence.

## If you ever want other people to use this

If this stops being personal-only and needs to serve other users, publishing status moves to "In production," and Google's verification process (including CASA for the restricted Gmail scopes above) becomes mandatory -- that part of the original blocker framing was accurate for that scenario. Revisit this doc if that becomes the goal.
