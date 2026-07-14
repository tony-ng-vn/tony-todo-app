# What's left, and exactly how to do each one

Everything in this doc is something only you can do -- an agent can't complete any of it (account creation, real credentials, and dashboard config are all outside what an agent should touch).
Do them in this order; each one only unblocks what it says it unblocks, nothing more.

## 1. Sign up for your real account

This is the one to do first. It unblocks the most: your original 8 todos (still sitting under the old anonymous ID) and the recurring ingestion schedule both need a real account to exist before anything else can move.

1. Go to `https://tony-todo-app.vercel.app` (the live production deployment).
2. Use the sign-up form to create your own account with your real email and a password.
3. Tell me once it's done, and give me the email you used.
4. I'll reassign the 8 original pre-auth todos to your new account with a one-time database update, and set up the recurring Granola ingestion schedule pointed at your account.

Note: `require_email_verification` is currently off (I disabled it earlier to unblock testing), so sign-up should work immediately without a confirmation email. Re-enabling it depends on step 3 below.

## 2. Google Cloud OAuth setup (only if you want Gmail + Calendar)

Full step-by-step instructions already live in `docs/google-oauth-setup.md` -- follow that doc exactly. Short version: create a Google Cloud project, enable the Gmail and Calendar APIs, configure the OAuth consent screen in "Testing" mode with yourself as the only test user (no security review needed for personal use), create an OAuth client ID, and send me the Client ID and Client Secret so I can store them as InsForge secrets.

Important: finishing this step does not turn Gmail/Calendar on by itself. Once you hand me the credentials, I still need to build and live-test the actual ingestion function and OAuth callback against your real Gmail account -- that's real follow-up work on my end, not just config.

## 3. SMTP setup (only if you want email verification, or plan to invite anyone else)

Not needed for solo use as-is. Do this if you want sign-up to require a confirmed email, or if you'll ever add a second user.

1. Pick an email-sending provider that gives you SMTP credentials -- Resend, Postmark, and Mailgun all have workable free tiers.
2. Create an API key / SMTP credential there and note the host, port, username, and password it gives you.
3. Go to your InsForge project dashboard -> Authentication settings -> SMTP, and enter those values directly there.
   (The password specifically has to go in the dashboard, not in `insforge.toml` -- that file is committed to git, so a real SMTP password should never end up in it.)
4. Once SMTP is verified working, tell me and I'll flip `require_email_verification` back on via `insforge.toml`.

## 4. Delete the disposable test account (housekeeping, not blocking anything)

During this project's build-out, I used a disposable test account (`extraclaude+e2e-test@twango.dev`) to verify auth, ingestion, and drafting end-to-end without ever touching your real data. It holds no data right now, but there's no safe way for an agent to delete an `auth.users` row directly.

1. Go to your InsForge project dashboard -> Authentication / Users.
2. Find `extraclaude+e2e-test@twango.dev` and delete it.

This can happen any time -- it's not blocking anything else on this list.

## Quick reference: what depends on what

- Reclaiming your old todos: needs step 1 only.
- Recurring ingestion schedule: needs step 1 only.
- Gmail + Calendar: needs step 2, plus follow-up build work from me afterward.
- Email verification on sign-up: needs step 3.
- Nothing depends on step 4.
