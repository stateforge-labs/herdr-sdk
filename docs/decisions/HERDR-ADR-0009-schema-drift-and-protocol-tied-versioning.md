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

- Port drift into `src/drift/` (pure) + `bin/herdr-drift.ts` (exit 0 clean, 1 drift, 2 usage, 3 not covered); also compare herdr version, field shapes and unmapped methods. `bun run capture` writes the schema and `herdr-version.json`. Runs in the owner's delivery gate (mise task), not CI.
- Protocol policy is a value: `exact` (default) or `minimum`; mismatch raises `ProtocolMismatchError`/`ProtocolMismatch` with expected and actual.
- Semver tied to herdr: protocol change or removed/renamed/narrowed API = major; added methods/events = minor; else patch. `package.json` `"herdr": { protocol, schemaVersion, testedWith }`, exported as constants; CHANGELOG names the herdr version.

## Consequences

- Good: upgrades are a documented sequence, not a surprise in production.
- Bad: drift is only as frequent as the owner runs the gate.
