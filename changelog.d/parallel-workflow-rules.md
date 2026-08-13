**Docs**

- Agents now claim work by opening draft PRs early, review their own branches before marking PRs ready, and keep dependency bumps in separate PRs, so parallel agents stop colliding.
- A deploy runbook documents the safe backend deploy sequence, including the migration drift check and the lessons learned from the v0.10.0 deploy.
