---
id: HERDR-ADR-0015
title: "Dependency policy and size budget"
status: proposed
date: 2026-11-02
decision-makers: owner
summary: "No runtime dependencies; exact pins at least 14 days old, checked by a script; size budgets are measured in phase 0 and 2b and enforced per entry, with a strictly smaller hub number and a no-leak test."
---

# HERDR-ADR-0015: Dependency policy and size budget

Plan: [section 2 dependency policy](../architecture/plan.md#2-location-packaging-versioning-runtimes-dependencies), [section 10.1](../architecture/plan.md#101-size-table). C4: none (policy).

## Context and problem statement

Earlier budgets ("core < 6 KB", "herdr code < 10 KB") were guesses. The hub runs from source (`hub/Containerfile` `CMD ["bun", "src/apps/voice-hub/main.ts"]`), so "bundle size" is a synthetic measure. On 2026-11-02 `effect` 4.1.2 (released that day) and `@types/bun` 1.4.4 (2026-10-23) are younger than 14 days (`npm view <pkg> time`).

Evidence: [R-2026-11-02-04](../../../../docs/research/studies/2026-11-02-herdr-size-baseline/README.md)

## Decision outcome

- Runtime dependencies: none. Peers: `effect` (optional). Dev: exact pins listed with release dates in plan section 2; `scripts/check-pins.ts` rejects ranges and pins under 14 days old. TypeDoc dropped.
- Size: phase 0 records baselines (hub herdr code, atalaya client); phase 2b sets per-entry budgets from measurement; `scripts/check-size.ts` enforces them. Hub herdr code must be strictly smaller; installed bytes of `node_modules/@homelab/herdr` are reported; a no-leak test greps the hub bundle for test-kit and mcp strings.

## Consequences

- Good: claims are numbers with commands.
- Bad: adopting the hub's newest pins waits until they are 14 days old.
