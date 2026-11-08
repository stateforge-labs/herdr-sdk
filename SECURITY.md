# Security policy

## Supported versions

Security fixes go to the latest published `0.x` minor release of `@stateforge-labs/herdr-sdk`. Older minors do not get fixes; upgrade to the latest release.

## Reporting a vulnerability

Do not open a public issue or pull request for a vulnerability.

Report it privately with GitHub private vulnerability reporting:

https://github.com/stateforge-labs/herdr-sdk/security/advisories/new

Include the affected version, the runtime (Node or Bun and its version), the herdr version, a description of the impact and the smallest reproduction you can give. Do not include tokens, socket contents or private paths.

## What to expect

- We acknowledge a report within 14 days.
- We confirm or dismiss the report with a short explanation, and keep you informed while we work on a fix.
- We aim to publish a fix and a GitHub security advisory within 90 days of the report. If a fix needs longer, we tell you why and agree a date with you.
- A confirmed vulnerability gets a GitHub security advisory and, where one applies, a CVE. We credit the reporter unless you ask us not to.

## Scope

In scope: the code in this package, its published subpaths and its bins (`herdr-drift`, `herdr-skill`), and the agent skill it ships.

Out of scope: herdr itself (report to its maintainers), and issues that need a local attacker who already runs code as the same user as herdr.

## Project checks

Static analysis (GitLab SAST) and secret detection run in the merge request pipelines of the project. Dependency versions are pinned exactly and updated through Renovate, with a 14-day release age.
