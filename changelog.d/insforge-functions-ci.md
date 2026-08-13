**CI & Tooling**

- Merging a function change to main now deploys it from GitHub after tests pass, and the job fails if live source still does not match the repo.

**Docs**

- Backend changelog entries describe merged code; they are not live until the InsForge functions GitHub job is green. Agents must not deploy functions.
- The deploy runbook now treats GitHub Actions as the function deploy path; laptop deploys are not the production path.
- AGENTS.md now leads with the incremental commit rule, before the InsForge skill-sync block. A feature is a PR; each component step is its own commit.
