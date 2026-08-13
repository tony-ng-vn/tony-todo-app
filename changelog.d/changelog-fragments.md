**CI & Tooling**

- Concurrent PRs no longer conflict on the changelog or version number: each PR now drops its own changelog fragment, and releases compile them into CHANGELOG.md and bump the version in one step.
