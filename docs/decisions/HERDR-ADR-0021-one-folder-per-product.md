---
id: HERDR-ADR-0021
title: "One folder per product, tests mirror the sources, build tooling under tools/"
status: proposed
date: 2026-11-08
decision-makers: owner
amends: HERDR-ADR-0003
summary: "Errors are centralized per product and small files are merged by topic. The package holds two clients: the herdr server client (protocol 22) and the herdr-core client (HERDR-ADR-0020). Each gets one folder under src/ (src/herdr/, src/core/), test/ mirrors src/ one to one, and the build-time code (gen/, scripts/, rules/) moves under tools/. Entry files, subpath exports and the layer rules are unchanged."
---

# HERDR-ADR-0021: One folder per product

## Context and problem statement

HERDR-ADR-0003 put each layer of the herdr server client in its own top-level folder under `src/` (`generated`, `wire`, `client`,
`effect`, `test-kit`). HERDR-ADR-0020 added a second, independent client for herdr-core in `src/core/` and its fake in
`src/core-test-kit/`. The tree no longer told the two products apart: five folders of one product sat beside one folder of the other.
The tests did not mirror the sources either (`test/connect`, `held`, `long-poll`, `scoped`, `subscribe` and `watch` are parts of
`src/client/`), and the build-time code was spread over three top-level folders (`gen/`, `scripts/`, `rules/`).

## Decision

- `src/herdr/` holds the herdr server client: `wire/`, `client/`, `generated/`, `effect/`, `test-kit/` (and `model/` when it exists).
- `src/core/` holds the herdr-core client; its fake core moves to `src/core/test-kit/`.
- `src/drift/` (the schema-drift tool) stays where it is.
- The entry files stay at the top of `src/` (`index.ts`, `read-only.ts`, `admin.ts`, `effect.ts`, `schema.ts`, `drift.ts`,
  `test-kit.ts`, `core.ts`, `core-test-kit.ts`), so the `exports` map and every published subpath are unchanged; `dist/` mirrors `src/`.
- `test/` mirrors `src/`: `test/herdr/{wire,client/{connect,held,long-poll,scoped,subscribe,watch},effect,test-kit}`, `test/core/`,
  `test/drift/`; tests of the tooling sit in `test/tools/{gen,scripts}`; `integration/`, `types/`, `support/`, `schema/`, `skill/`
  and `size/` stay.
- `gen/`, `scripts/` and `rules/` move to `tools/gen/`, `tools/scripts/` and `tools/rules/`. Nothing under `tools/` is published.

The layer rule of HERDR-ADR-0003 is unchanged in substance. `tools/rules/layers.ts` now keys each layer by its folder path under `src/`
(`herdr/wire`, `core/test-kit`, ...), and the gate picks the longest matching folder. The directories `src/` may never import are
`tools`, `test`, `examples` and `bin`.

### Errors, one module per product

- `src/herdr/errors.ts` holds every error the server client and its tools throw: `HerdrError`, `HerdrTransportError`,
  `ProtocolMismatchError`, `UnsupportedByServerError`, `SubscriptionEnded`, `UnsupportedWatchError` (a `TypeError`, for a per-pane type
  watchPaneSet cannot follow yet), `MalformedSchemaError` (drift) and `NotImplementedError`. Names and messages stay in `src/constants.ts`
  (`ErrorName`, `ErrorText`). It is its own layer, `errors`, which imports constants and generated only and which every herdr layer and drift may import.
- `src/core/errors.ts` holds every failure of the core client: `Unknown` and `Unknowable` (failures as values; the core client never
  throws on a call), `ParseFailure`, and `CoreInvariantError`, thrown by `must()` when a load-time constant fails its own parser.
- No library code throws a bare `Error` or `TypeError`. The fake cores of the two test kits keep their own fault values.

### Small files merged by topic

The 150 files under `src/` (75 of them under 40 lines) became 77. Each folder of small helpers became one module named for its feature:
`wire/codec.ts` (ids, envelopes, line splitter, protocol policy, typed helpers, call hook); `client/connect.ts`, `client/scoped.ts`,
`client/subscribe.ts`, `client/watch.ts`, `client/watch-pane-set.ts`, `client/held.ts`, `client/long-poll.ts`;
`test-kit/fake-protocol.ts` and `test-kit/fake-herdr.ts`; `drift/schema.ts`, `drift/diff.ts`, `drift/cli.ts`; `core/kernel.ts`.
Two splits stay on purpose:
- `client/streams.ts` stays apart from `client/scoped.ts`: it is loaded through `import()` on first use, so a client that never streams
  does not carry subscribe, watch and held (plan 10.1 step 3; the size gate checks the lazy chunk).
- `generated/` keeps one module per kind and per entry: each entry imports only its own method list, which keeps the bundles in budget.

Tests keep one file per concern; their folders name the module they test (`test/herdr/client/watch/` tests `client/watch.ts` and `client/watch-pane-set.ts`).

### Kinds as objects, dispatch as maps

- Every set of kinds, states and wire names is an `as const` object with a type of the same name (the server client's
  `src/constants.ts` already worked this way; the core client now does too, in `src/core/constants.ts`, `src/core/errors.ts` and
  `src/core/kernel.ts`): `HcKind`, `HcNotificationMethod`, `HcField`, `LinkState`, `EventsPhase`, `Life`, `RetryPhase`, `TimerHold`,
  `ResultKind`, `ParseFailureKind`, `UnknownWhy`, `OutcomeKind`.
- A choice over a tagged union is a lookup, not a chain of comparisons: a `KindMap<U, R, C>` has one handler per kind (the compiler
  refuses a missing one), and `byKind(map, value, context)` runs it. Results and failures are tested with `isOk`, `isErr` and `isUnknown`.
- The layer gate's `no-literal-compare` rule refuses a comparison with a string literal anywhere in `src/`.
- Every string and number of the core client lives in `src/core/constants.ts` (plain data that imports types only, so the kernel and the
  errors can import it; messages are functions in `CoreText`), and those of its fake in `src/core/test-kit/constants.ts`. The gate's
  `core-strings-centralized` rule refuses any other string in the core layers; import paths and brand names are not counted, and the
  recorded frames (`test-kit/frames.ts`) are data.

## Consequences

- Consumers see no change: the same subpaths, the same types.
- Generated files now say `GENERATED by tools/gen/`, and `bun run gen` writes to `src/herdr/generated/`.
- `docs/architecture/plan.md` and `contracts.md` describe the layout of 2026-11-02 and keep their paths; a note at their top points here.
- A later product (for example a herdr-app client) gets its own folder under `src/` and its own entry, by the same rule.
