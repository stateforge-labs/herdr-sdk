---
id: HERDR-ADR-0003
title: "Layering and subpath entry points, zero-dependency core"
status: proposed
date: 2026-11-02
decision-makers: owner
summary: "Layers generated, wire, client, then effect/mcp; one subpath export per entry; one generated method table feeds names, capability sets and the namespace tree; the core has no runtime dependencies."
---

# HERDR-ADR-0003: Layering and subpath entry points, zero-dependency core

Plan: [section 3](../architecture/plan.md#3-layered-design), [3.3](../architecture/plan.md#33-core-client-promise), size table [10.1](../architecture/plan.md#101-size-table). C4: `2 · Containers / @homelab/herdr`.

## Context and problem statement

atalaya's `HerdrClient` builds 12 service classes eagerly (`src/herdr-client.ts`, `src/services/*`); the hub vendors 13 files it partly uses (`hub/src/shared/vendor/atalaya/**`). A runtime namespace tree (`herdr.pane.list`) is a property-access object: bundlers cannot shake unused namespaces out of it.

## Decision outcome

Folders `src/{generated,wire,client,effect,drift,test-kit,mcp}`; rule `generated <- wire <- client <- {effect, mcp}`; `test-kit` imports only `wire` and `generated`; only `effect/` and `mcp/` import `effect` (checked by `rules/layers.dependency-cruiser.cjs`; phase 1b implements the rule as data in `rules/layers.ts` checked by `scripts/check-layers.ts` with no dependency; the table can move to dependency-cruiser later, after an ADR-0015 review). Subpath exports `.`, `./read-only`, `./admin`, `./effect`, `./drift`, `./test-kit`, `./mcp` (and `./model` in phase 7); `"sideEffects": false`.

The namespace tree is built eagerly from the entry's allow-list (the generated list the connect function imports; **2026-11-02 amendment:** not the `METHODS` table, plan 10.1 step 2); `Method`, capability sets and paths derive from the generated names. We do not claim namespace tree-shaking: entries shake, namespaces do not. Standalone per-method functions are a possible later minor if measurement asks for it.

Every subpath entry names its real consumer, verified by what that consumer imports. An entry without one does not ship in 1.0. This extends the HERDR-ADR-0010 rule for `/mcp` to every entry (from delivery-handbook ADR-0041 decision 3, 2026-09-20: "split on a second real consumer, not a predicted one"; [HERDR-ADR-0016](HERDR-ADR-0016-design-intent-inherited-from-atalaya.md) P8). `src/wire` and `src/client` import no `node:child_process`, because the runtime never spawns `herdr` (P1).

## Consequences

- Good: Node consumers import no Effect; test-kit and mcp never reach production bundles (no-leak test).
- Bad: every client carries the full name table once; its size is measured, not guessed ([HERDR-ADR-0015](HERDR-ADR-0015-dependency-policy-and-size-budget.md)).
