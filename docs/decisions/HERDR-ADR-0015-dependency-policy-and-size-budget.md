---
id: HERDR-ADR-0015
title: "Dependency policy and size budget"
status: proposed
date: 2026-11-02
decision-makers: owner
summary: "No runtime dependencies; exact pins at least 14 days old, checked by a script; size budgets are measured in phase 0 and 2b and enforced per entry, with a strictly smaller hub number and a no-leak test."
---

# HERDR-ADR-0015: Dependency policy and size budget

Plan: [section 2 dependency policy](../architecture/plan.md#2-location-packaging-versioning-runtimes-dependencies), [section 9.1](../architecture/plan.md#91-size-table). C4: none (policy).

## Context and problem statement

Earlier budgets ("core < 6 KB", "herdr code < 10 KB") were guesses. The hub runs from source (`hub/Containerfile` `CMD ["bun", "src/apps/voice-hub/main.ts"]`), so "bundle size" is a synthetic measure. On 2026-11-02 `effect` 4.1.2 (released that day) and `@types/bun` 1.4.4 (2026-10-23) are younger than 14 days (`npm view <pkg> time`).

Evidence: R-2026-11-02-04 (omarchylab repository, `docs/research/studies/2026-11-02-herdr-size-baseline/`)

## Decision outcome

- Runtime dependencies: none. Peers: `effect` (optional). Dev: exact pins listed with release dates in plan section 2; `scripts/check-pins.ts` rejects ranges and pins under 14 days old. TypeDoc dropped.
- Size: phase 0 records baselines (hub herdr code, atalaya client); phase 2b sets per-entry budgets from measurement; `scripts/check-size.ts` enforces them. Hub herdr code must be strictly smaller; installed bytes of `node_modules/@homelab/herdr` are reported; a no-leak test greps the hub bundle for test-kit strings.

**2026-11-02 (budgets per consumer scenario).** The gate `bun run check:size` builds `dist/` and measures it with `bun build --minify --target node --external effect --splitting`. Rows: the dist entries `.`, `/read-only`, `/admin`, `/effect`, the lazy chunks of `.`, and four scenarios that import the package by name (`test/size/scenarios/`: a, a-preset, b, c). The budget of each row is its measured size plus about 10 % (plan section 9.1). A budget moves down when the code shrinks, and an increase needs a note here. A no-leak check fails the gate when a production row or a scenario contains test-kit, generated test data, drift data, `METHODS`, the entry method lists or `child_process`; `/read-only` and read-only scenarios also refuse the admin and effect inputs (HERDR-ADR-0005). The budgets of the first run are set from `dist/` as it stood before the lazy-streams and generated-table slices (plan 9.1 steps 2 to 4). The owner's targets are in plan 9.1 and are not met yet.

**2026-11-02 (plan 9.1 steps 2 and 3 applied; budgets re-set).** The namespace tree is built from the allow-list, not from the `METHODS` table; each connect function imports only its own list (`generated/entries/*`, `generated/presets/*`), and `PRESET_METHODS` is in its own module; the streams (`events.subscribe`, `watch`, `hold`) load through a dynamic import (`client/scoped/lazy-streams.ts` loads `streams.ts`). The budget of each row is the measured `dist/` size plus about 10 %, rounded up to 100 B, and never above the owner's ceiling. Measured, then budget: dist `.` 26,887 B, 29,600; `/read-only` 18,691 B, 20,600; `/admin` 15,561 B, 17,200; lazy streams 7,672 B, 8,500; scenario a 17,513 B, 19,000 (ceiling; 10 % would be 19,300); a-preset 14,221 B, 15,000 (ceiling; 10 % would be 15,700); b 22,158 B, 24,400; c 15,091 B, 16,600. Every row is at or below its ceiling, and the no-leak check passes.

Not done: plan 9.1 step 4 (split `constants.ts` into `constants/`). 120 files import it, and the one impure initializer (`GLOBAL_SUBSCRIPTION_TYPES`) is not the cause: an `/* @__PURE__ */` annotation on it left the 2,576 B of `constants` in the read-only chunk unchanged. The split is deferred until a measurement shows its gain. `dist/generated/names/method.js` (about 5 KB in the full entry) stays because `Method` is public API on `.` and `/read-only`.

Measurement fix in the same change: bun marks a chunk that only a dynamic `import()` reaches as an entry point, and `staticClosure` treated it as static, so the lazy row read 0 B. It now counts such a chunk as lazy (`test/scripts/size-measure.test.ts`).

## Consequences

- Good: claims are numbers with commands.
- Bad: adopting the hub's newest pins waits until they are 14 days old.
