---
id: HERDR-ADR-0002
title: "Generate the client from herdr's published schema"
status: proposed
date: 2026-11-02
decision-makers: owner
summary: "Types, name constants, the namespace tree, capability sets and coverage data are emitted from herdr api schema --json by the ported atalaya generator."
---

# HERDR-ADR-0002: Generate the client from herdr's published schema

Plan: [section 3.2](../architecture/plan.md#32-generator) and [section 4](../architecture/plan.md#4-api-coverage).

## Context and problem statement

atalaya's `src/herdr-client.ts` + `src/services/*` (~210 lines) are hand-written and drift from herdr; its committed schema is 0.9.0 and already misses `pane.clear`, `pane.link.resolve`, `server.ssh_agent.register`. The generator `gen/*.ts` (~330 lines, zero deps) works; the hub keeps hand constant maps (`hub/src/shared/infra/herdr/wire.ts`), which break the "no string-literal comparisons" rule only by luck.

## Decision outcome

Port `gen/` with path parameters (`gen/schema.ts:27-31`) and add emitters: one method table (`emit-method-table.ts`) from which `Method`, capability sets and namespace paths derive; `emit-names.ts` (`as const` objects); `emit-namespaces.ts` (types per class and `EffectClient`); `emit-defaults.ts` and `emit-shapes.ts` (fake defaults and request checker); `emit-docs.ts`. The method → result map has no schema source: it is seeded from atalaya (25) and name matches (30), the rest from herdr docs or one recording, destructive methods by documentation only; each row names its source; `LOOSE` needs a reason; the generator fails on an unmapped or unclassified method. Real schema constructs (duplicate defs across bundles, recursive `LayoutNode`, `propertyNames` maps, nullable arrays, shared params) each get a fixture test. Wire shapes are emitted as plain, type-only TypeScript (erased), not Effect Schema. Output is committed in `src/generated/`; `bun gen/index.ts` must reproduce it (git diff clean).

## Consequences

- Good: a new herdr method fails the build until classified; coverage is proven by `test/coverage.test.ts` (102/26/27/63).
- Bad: no full runtime decoding of results; only envelope and push-line shape are checked ([HERDR-ADR-0003](HERDR-ADR-0003-layering-and-entry-points.md)).
