---
id: HERDR-ADR-0017
title: "Interfaces are locked before parallel implementation"
status: proposed
date: 2026-11-02
decision-makers: owner
summary: "The remaining phases (2a fixes, 2b, 3, 4a, 4b, 5a, 5c, 6a, then 6b) are built in parallel on contract files written first. Lanes may not change a contract; a lane that needs a change stops and reports, and the architect amends the contract."
---

# HERDR-ADR-0017: Interfaces are locked before parallel implementation

Plan: [section 9](../architecture/plan.md#9-delivery-phases). Contract map and lane ownership: [contracts.md](../architecture/contracts.md). C4: no element changes.

## Context and problem statement

The owner wants the remaining phases built at the same time. The phases meet at a few seams: wire ↔ client, client ↔ subscribe/watch/held, core ↔ test kit, core ↔ Effect, schema ↔ drift. If each lane designs its side of a seam on its own, the lanes drift apart and the integration rewrites both sides. Phase 2a was already partly built (197f5f9, not reviewed), so the contracts have to fit what is sound in it.

## Decision outcome

- **The contract files are the seam.** There is one contract file per layer or sub-layer, in the folder the plan names: `src/wire/types.ts` (plus `wire/errors.ts` and `wire/typed.ts`), `src/client/types.ts`, `src/client/{subscribe,long-poll,watch,held}/types.ts`, `src/test-kit/types.ts`, `src/drift/types.ts`, `src/effect/types.ts`, and the contract section of `src/constants.ts`. They hold types and function types with JSDoc, and no behaviour.
- **Every unbuilt function exists today as a typed stub.** `export const f: ContractType = () => notImplemented('f', Lane.Px)`, from one helper (`src/not-implemented.ts`). So every lane can import, compose and type-check against the whole surface now. The owning lane replaces the body and keeps the annotation.
- **Lanes may not change contract files.** Contract files belong to no lane. A lane that needs a change stops and reports what it needs and why. The architect writes a **contract amendment** (a commit that changes the contract, its contract tests and `contracts.md`, and names the affected lanes). Planned amendment: **A1** on 2026-11-16, when `effect` 4.1.2 becomes adoptable (HERDR-ADR-0015). A1 turns the Effect prose into types before P6a starts.
- **Each lane owns disjoint paths** ([contracts.md](../architecture/contracts.md#lane-ownership)). The shared files (`package.json`, the entry files, README, docs, rules, tsconfigs) are edited only by the integration step. `src/constants.ts` is append-only, with one section per lane.
- **Contract tests lock the DX target.** `test/types/contract/*.ts`, compiled by `tsc -p test/types` (`bun run typecheck:types`), check that the README snippets compile and that the scoped clients exclude what HERDR-ADR-0005 excludes (`@ts-expect-error` must hold).
- **Atalaya's intent (HERDR-ADR-0016) is part of the contract text**: one request per connection, subscribe owns its connection, events carry no id, `id:""` then EOF is an answer, unknown kinds become `UnknownFrame`, the runtime never spawns the CLI, and generated code is regenerated only by P3.

## Consequences

- Good: lanes run in parallel without waiting on each other's code. A lane tests against stubs or in-memory fakes of the other layers, and integration is mostly re-exports.
- Good: a design question surfaces as one amendment, not as two incompatible implementations.
- Bad: a wrong contract costs a stop-and-report round trip. The Effect contracts are prose until A1, so they are checked by review, not by the compiler.
- Neutral: phase 2a's code moved under the contract (`connect` → `connectCore`, `server` → `serverInfo`, types moved into `types.ts` files); [contracts.md](../architecture/contracts.md#notes-for-the-p2a-lane-review-of-197f5f9) lists what the 2a lane must still change.
- Contract review (2026-11-02): one amendment applied 19 findings before any lane started ([contracts.md, review log](../architecture/contracts.md#contract-review-log-2026-11-02)). It adds `ClientTransport` (resolved settings and a close signal that ends every stream), injects the tree builder into `HoldDeps` (one builder; P2b lands it first as slice P2b-1), freezes the P2a exports other lanes read, and plans two dated integration items: A0 (2026-11-06, `@types/bun`, all tests type-checked) and A1 (2026-11-16, `effect`, Effect types and `effect/services.ts` stubs).
- **2026-11-02: amended for the compiled low-footprint build (owner requirement), generator part applied.** The generated layout changed and public exports did not: `names.ts` is now `names/` (one module per kind, plus `method.ts` with one `MethodX` constant per method); `methods.ts` is `method-table.ts` (`METHODS`, `MethodName`); `entry-methods.ts` aggregates per-entry lists in `entries/` and presets in `presets/`; `shapes.ts` and `defaults.ts` moved to `test-data/`. `METHODS`, `ENTRY_METHODS`, `PRESET_METHODS`, `Method` and `TOKEN_NAME_PATTERN` keep their names and types from `generated/index.ts`. Still pending, and to be applied in the client slice (plan 9.1 step 2): `AllowedMethods` takes the entry's base list, not the entry name; `composeClient` takes an optional `StreamMembers`; library code imports `MethodX` constants, not the `Method` object. Those signatures are not changed by this note.
- **2026-11-02: build part applied (plan 9.1 steps 5 to 7).** `dist/` is built by `tsc` (tsconfig.build.json, tsconfig.build-test-kit.json), with the `.d.ts` specifiers rewritten by `scripts/rewrite-dts.ts`. Public exports, names and types are unchanged. `bin/herdr-drift.ts` is now `bin/herdr-drift.js`, which calls `src/drift/cli.ts` through `dist/`. `scripts/size-constants.ts` and `scripts/size-measure.ts` take the size literals and the measuring code out of `src/constants.ts`. The size gate measures `dist/`, not `src/`.
- **2026-11-02: client part applied (plan 9.1 steps 2 and 3).** `AllowedMethods` takes the entry's base list (`allowedMethods(base, { methods })`), not the entry name. `composeClient` and `composeOrClose` take an optional fourth argument, `StreamMembers` (default: `lazyStreams(core)`). Library code imports `MethodX` constants, not the `Method` object (checked by `scripts/check-layers.ts`, rules `method-value-use` and `method-value-import`). `PRESET_METHODS` moved to `generated/preset-methods.ts` with the same name and type. Public exports, names and result types are unchanged. `watchFor` no longer refuses: `compose.ts` refuses synchronously, before anything loads.
