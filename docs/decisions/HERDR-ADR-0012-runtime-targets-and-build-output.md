---
id: HERDR-ADR-0012
title: "Runtime targets (Bun first, Node) and compiled build output"
status: proposed
date: 2026-11-02
decision-makers: owner
summary: "The package runs on Bun 1.4.4 and Node >= 22.18, uses no Bun APIs in src, and ships compiled dist JavaScript with declarations built by tsc."
---

# HERDR-ADR-0012: Runtime targets (Bun first, Node) and compiled build output

Plan: [section 2 build and runtimes](../architecture/plan.md#2-location-packaging-versioning-runtimes-dependencies). C4: none (build output is not a C4 element).

## Context and problem statement

The hub runs on Bun (hub ADR-0001/0028); atalaya pins Node >= 24. Node refuses to strip types inside `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), so shipping `.ts` breaks Node consumers. The hub fake uses `Bun.listen`.

## Decision outcome

Source is TypeScript with `erasableSyntaxOnly`; `tsc` 7.0.2 (same pin as the hub) emits `dist/*.js` + `.d.ts`; no bundler. `src/` uses only `node:*` modules, no `Bun.*`. The suite runs on Bun and on Node (`node --test` over `dist`) in CI. Exact dev pins, each at least two weeks old ([HERDR-ADR-0015](HERDR-ADR-0015-dependency-policy-and-size-budget.md)).

**2026-11-02 (build details, owner requirement: low footprint).** `tsconfig.build.json` emits unbundled per-module ESM and `.d.ts` into `dist/` (`rootDir` `src`, `removeComments` false so the JSDoc reaches the `.d.ts` files, `declarationMap` false because `src/` is not shipped). `tsconfig.build-test-kit.json` emits the test-kit and its generated test data beside them. `scripts/rewrite-dts.ts` runs last: tsc 7.0.2 leaves the relative `.ts` specifiers of the declarations unchanged, and consumers cannot resolve them. The package has no per-entry bundles: a bundle would duplicate the core in each entry, and the consumer's bundler takes only the modules it reaches. Exports use the `types` and `default` conditions, with no `bun` condition, so Bun also loads the artefact that the size gate measures. `bin/herdr-drift.js` is the only Node-run file; it spawns the herdr CLI and calls `dist/drift/cli.js`. `prepack` runs the build.

## Consequences

- Good: one artefact for both runtimes.
- Bad: a build step before packing; checked by the phase 2 gate.
