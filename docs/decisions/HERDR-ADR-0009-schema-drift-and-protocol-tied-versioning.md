---
id: HERDR-ADR-0009
title: "Schema drift and protocol-tied versioning"
status: proposed
date: 2026-11-02
decision-makers: owner
summary: "A drift command compares the committed schema with the installed herdr; package versions follow the herdr protocol and schema, and connect() fails with a clear ProtocolMismatchError."
---

# HERDR-ADR-0009: Schema drift and protocol-tied versioning

Plan: [section 2 versioning](../architecture/plan.md#2-location-packaging-versioning-runtimes-dependencies) and [section 6](../architecture/plan.md#6-schema-drift). C4: `2 · Containers` (drift tooling).

## Context and problem statement

Hub ADR-0012 pins protocol 22, not the binary (`hub/src/shared/infra/herdr/protocol-policy.ts`). atalaya has a clean drift checker (`bin/herdr-drift.ts`, `src/{drift,inventory,schema-source}.ts`, tests in `test/drift.medium.test.ts`) that calls `process.exit` inside library code and ignores field shapes.

## Decision outcome

- Port drift into `src/drift/` (pure) + `bin/herdr-drift.ts` (exit 0 clean, 1 drift, 2 usage, 3 not covered); also compare herdr version, field shapes and unmapped methods. `bun run capture` writes the schema and `herdr-version.json`. Runs in the owner's delivery gate (mise task), not CI. Retirement condition for that gap: the first CI runner image or scheduled host that carries herdr (atalaya `AGENTS.md:110-114`).
- "Could not look" is 3, never 0: a missing herdr or an unreadable committed schema exits 3, because a gate that did not run is not green (atalaya `bin/herdr-drift.ts`, ADR-0037:207-208). A behaviour test asserts it. The report lists added and removed separately.
- Bump evidence (ADR-0037:91-105, measured 2026-09-20): protocol 20 to 22 added 11 methods and 6 result tags and removed 0; event kinds (26) and subscribable types (27) did not change. This additive bound is why `minimum` is offered. Upgrade step: if drift shows any removal, treat the bump as major and re-evaluate `exact` vs `minimum`.
- Protocol policy is a value: `exact` (default) or `minimum`; mismatch raises `ProtocolMismatchError`/`ProtocolMismatch` with expected and actual.
- Semver tied to herdr: protocol change or removed/renamed/narrowed API = major; added methods/events = minor; else patch. `package.json` `"herdr": { protocol, schemaVersion, testedWith }`, exported as constants; CHANGELOG names the herdr version.

## Consequences

- Good: upgrades are a documented sequence, not a surprise in production.
- Bad: drift is only as frequent as the owner runs the gate.

## Amendment 2026-11-07: 0.2.0

0.2.0 removes the `/mcp` subpath and its bearer guard, token file and tool-name helper, which moved to the separate herdr-mcp repo (a removed API, so a new minor while the version is below 1.0.0), and adds the `/schema` entry and the `skills/herdr-sdk` agent skill (HERDR-ADR-0018). Protocol 22 and schema version 1 are unchanged.
