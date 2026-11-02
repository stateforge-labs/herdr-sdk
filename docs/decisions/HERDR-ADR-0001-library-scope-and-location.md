---
id: HERDR-ADR-0001
title: "Library scope and location: packages/herdr in omarchylab, @homelab/herdr"
status: proposed
date: 2026-11-02
decision-makers: owner
summary: "One private package in omarchylab holds the whole herdr socket API client for hub, atalaya and scripts; app domain stays in the consumers."
---

# HERDR-ADR-0001: Library scope and location: packages/herdr in omarchylab, @homelab/herdr

Plan: [section 1 and 2](../architecture/plan.md#2-location-packaging-versioning-runtimes-dependencies). C4: `1 · Context`, `2 · Containers` ([../architecture/c4/](../architecture/c4/)).

## Context and problem statement

Two copies of the herdr client exist: atalaya-bridge 097adfd (`delivery-handbook/atalaya-bridge/src/{transport,protocol,client,events}`) and the hub vendor copy (`plugins/crisap94.voice-engine/hub/src/shared/vendor/atalaya/**`, ~1230 lines) plus the hub's own `src/shared/infra/herdr/*`. Each covers about 25 of herdr 0.9.5's 102 methods with strong types (`gen/method-result-map.ts`). Fixes land in one copy and not the other (the hub's `rpc.ts` already diverged: AbortSignal, destroy on settle).

## Decision outcome

Create `packages/herdr` in omarchylab, package name `@homelab/herdr`, private. Scope: the herdr wire, the full generated API, capability-scoped clients, a domain model, an Effect entry, a test kit, drift tooling and a read-only MCP add-on. Out of scope: a CLI, herdr state reimplementation (hub ADR-0004), app domains (attention, sessions views, atalaya messaging), Python bindings, public npm. Reason to exist (spine AD-10, [HERDR-ADR-0016](HERDR-ADR-0016-design-intent-inherited-from-atalaya.md) P7): the library is the one conformist adapter at the herdr wire, so consumers keep their own domain language behind their own port.

Rejected: inside the hub (not reusable), inside atalaya's workspace (hub would depend on another repo), own repo now (two-repo churn while the API moves; revisit after phase 6 with `git subtree split`).

## Consequences

- Good: one copy; the owner's documentation lives beside it (omarchylab convention).
- Bad: the hub image context is `hub/` only (`hub/compose.yaml:52-53`), so consumption needs a tarball first ([HERDR-ADR-0011](HERDR-ADR-0011-consumer-migration.md)).
- Note: licence and provenance (port of brooswit/jsHerdrSDK) are a plan risk row and open question 2, not an ADR.
