# Changelog fragments

Each PR that changes user-visible behavior adds ONE new file here, named after its branch or topic (for example `changelog.d/agent-key-hashing.md`).
Never edit `CHANGELOG.md`, `package.json`'s `version` field, or `native/App/Info.plist`'s `CFBundleShortVersionString` directly in a feature PR.
Those are compiled and updated together at release time by `npm run release:changelog -- <patch|minor|major>`, which reads every fragment in this directory, merges them into `CHANGELOG.md`, bumps the version everywhere it lives, and deletes the fragments it consumed.

## Format

A fragment contains one or more category sections, in the same shape as an existing `CHANGELOG.md` entry: a `**Category**` line, a blank line, then one or more `- ` bullets.
Leave a blank line between sections if a fragment touches more than one category.

Valid categories, in the order they are compiled:

- `Web App` (SvelteKit frontend)
- `Backend` (InsForge functions, migrations, auth config)
- `Native App` (macOS menu bar companion)
- `CI & Tooling` (hooks, scripts, verification)
- `Docs`

Only include the categories your change actually touched.
Write each bullet in plain language from the user's point of view, matching the style of existing `CHANGELOG.md` entries.

## Example

    **Backend**

    - Fixed a bug where drafting failed for meetings with no transcript.

    **Docs**

    - Documented the new rate limit in the onboarding guide.

## Why

Concurrent PRs used to conflict on `CHANGELOG.md` and on `package.json`'s version field whenever two of them landed close together.
Fragments let each PR add its own uniquely named file with no shared line to conflict on; the release step compiles them all in one place instead.
