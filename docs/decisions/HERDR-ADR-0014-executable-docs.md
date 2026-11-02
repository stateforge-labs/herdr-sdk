---
id: HERDR-ADR-0014
title: "Docs are executable: README-first, examples compiled and run"
status: proposed
date: 2026-11-02
decision-makers: owner
summary: "The README is written before the code; its snippets come from examples/*.ts by marked regions, checked by a script, compiled in CI and run against the fake where marked."
---

# HERDR-ADR-0014: Docs are executable: README-first, examples compiled and run

Plan: [section 8](../architecture/plan.md#8-documentation). C4: none (document).

## Context and problem statement

The owner wants the API shaped by its use and every change documented and reproducible in omarchylab. Extracting fenced blocks from the README fails on helper names (`metrics`, `render`) and duplicates a second mechanism (`examples/`).

## Decision outcome

One mechanism: `examples/*.ts` are the source; the README embeds them between `<!-- example:NAME -->` markers; `scripts/check-readme.ts` fails on any difference. Helpers are declared in `examples/_stubs.ts`. Examples typecheck in CI; those marked `run` execute against `createFakeHerdr()`. Snippets use the generated constants (`Method`, `AgentStatus`, `WatchKind`), never raw strings. Until code lands, the README is marked as the planned API.

## Consequences

- Good: documentation cannot drift from code.
- Bad: README edits go through `examples/` first.
