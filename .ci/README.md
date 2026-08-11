# CI learning loop v1

This repository treats CI failures as reusable engineering evidence instead of disposable logs.
The first version does not train a model.
It gives an AI repair agent structured memory, reproducible harnesses, bounded retries, and a reviewed path for turning successful repairs into project lessons.

## The loop

1. `npm run verify` runs the phases in `verification.json` and stops at the first failure.
2. The runner removes common credentials, normalizes machine-specific output, creates a stable fingerprint, and writes a local failure packet under `.ci-learning/`.
3. The matcher retrieves applicable files from `lessons/` by phase, project type, output pattern, or exact fingerprint.
4. `npm run ci:repair` gives the current packet and matched lessons to an AI agent, allows one repair, then runs canonical verification again.
5. The loop records every attempted repair and stops after three attempts by default.
6. A successful repair creates an untracked candidate lesson under `.ci-learning/`.
7. `npm run ci:promote -- --candidate <path> --id <slug> --title "<title>"` turns a reviewed candidate into a versioned lesson.
8. `npm run ci:replay` proves that every saved failure example still matches its lesson and that every lesson harness still passes.

The pre-push hook runs detection and verification automatically.
It never invokes the repair agent automatically.
This keeps normal pushes deterministic and prevents an AI process from silently rewriting a developer's work.

Local pushes run in `--mode push`, a declared subset of `verification.json` marked with `"pushGate": false` for the stages left out.
That subset covers the toolchain checks, the test suite, and the production build.
Clean install, the dependency audit, the native release build, and the native app bundle stay out of the local push gate and remain covered by the required GitHub checks, which always run the full plan.
`ci-verify.mjs` prints the skipped phases so the narrower local gate is never silent.

## Repair safety

The repair command refuses to run on `main` or `master`, does not commit or push, and allows at most five attempts.
The default adapter uses the locally authenticated Codex CLI with workspace-only write access.
Set `CI_REPAIR_AGENT_COMMAND` to a different command that accepts its prompt on standard input when another AI coding agent is preferred.

Failure packets and agent output stay in the ignored `.ci-learning/` directory.
Common bearer tokens, GitHub tokens, JWTs, and secret-like environment assignments are redacted before caching or prompting.
CI uploads only the redacted latest failure packet and retains it for 30 days.

### Known considerations

The repair prompt embeds redacted, unnormalized failure output, including whatever a failing tool or dependency printed.
Hostile or compromised tool output could try to steer the agent through that text.
The containment is the surrounding bounds, not the prompt itself: the repair loop is opt-in, it only runs on a feature branch, it never commits or pushes on its own, and every attempt is re-checked by the same canonical verification a human would run, so a steered agent still has to pass the real gate before its diff is treated as a candidate.

## Choosing among solutions

A lesson can hold multiple guidance entries with different `when`, `solution`, and `tradeoffs` fields.
Matching ranks project-specific and phase-specific lessons ahead of generic ones.
Repair history preserves the fingerprint before and after every attempt so a later shared system can rank solutions by context, success rate, regressions, and verification cost.

Humans still review promoted lessons in v1.
That review is the taste and judgment boundary: a repair that happened to pass once is evidence, not yet a universal rule.

## Reusing this in another repository

The portable boundary is:

- `.ci/verification.json` for repository-specific phases.
- `.ci/lessons/` for versioned project knowledge.
- `scripts/ci-learning-core.mjs` for normalization, redaction, matching, and prompts.
- The verify, replay, repair, and promotion entrypoints under `scripts/`.

Once this loop has accumulated real incidents in this repository, these generic scripts can move into a shared package and reusable GitHub workflow.
Each repository would retain only its verification plan, its project lessons, and any project-specific harnesses.
