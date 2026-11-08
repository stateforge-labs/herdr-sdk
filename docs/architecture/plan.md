---
id: HERDR-PLAN
title: "@homelab/herdr: a reusable library for the whole herdr socket API"
status: proposed
date: 2026-11-02
summary: "Extract and complete the herdr client (protocol 22, herdr 0.9.5: 102 methods, 26 event kinds, 27 subscription types) into packages/herdr: a zero-dependency Promise core, an admin subpath for destructive and server-control methods, an Effect entry, capability-scoped clients and a test kit, ported from atalaya-bridge 097adfd and the voice hub."
---

> Layout note (2026-11-08): the paths in this document are the layout of 2026-11-02. [HERDR-ADR-0021](../decisions/HERDR-ADR-0021-one-folder-per-product.md) moved them: `src/<layer>/` is now `src/herdr/<layer>/`, `src/core-test-kit/` is `src/core/test-kit/`, and `gen/`, `scripts/`, `rules/` are under `tools/`.

> **Historical (2026-11-07):** this plan was written when the library was `packages/herdr` in omarchylab. Where it says `packages/herdr`, read the root of `homelab/herdr-sdk`; where it describes tarball or release-asset distribution, [HERDR-ADR-0019](../decisions/HERDR-ADR-0019-publish-to-the-gitlab-npm-registry-on-a-tag.md) supersedes it (GitLab npm registry). The `/mcp` entry was removed from the library (see HERDR-ADR-0009, amendment 2026-11-07).

> Model: [`c4/`](c4/) · decisions: [../decisions/](../decisions/README.md) · guide: [../../README.md](../../README.md). Status rule as in the voice engine: everything here is **proposed** until the code lands.
> Sources: atalaya-bridge = `~/src/delivery-handbook/atalaya-bridge` (097adfd), HUB = `plugins/crisap94.voice-engine/hub`, schema = `herdr api schema --json` from herdr 0.9.5.
> ADR ids: this library's records are **HERDR-ADR-NNNN**; the voice engine's are always written **hub ADR-NNNN**.

## Summary and decisions needed

**What.** One private package, `packages/herdr` (`@homelab/herdr`), replaces the two copies of the herdr client (atalaya-bridge and the hub vendor copy) and covers all 102 methods with generated types.

**Layers.** `generated` (types and name tables from the schema) <- `wire` (NDJSON over the unix socket) <- `client` (namespaced calls, scoped clients, subscriptions, held connections) <- entries `.`, `/read-only`, `/admin`, `/effect`, `/schema`, `/test-kit`. Core and read-only have zero runtime dependencies; Effect is an optional peer.

**Decided in this revision** (previously open): `connect()` excludes destructive and server-control methods, which live in `/admin` (HERDR-ADR-0005); connection-bound methods get a held-connection API (HERDR-ADR-0007); `/model` is deferred until atalaya consumes it (HERDR-ADR-0006).

**Decisions still needed from the owner:** see [section 11](#11-open-questions-and-rejected-review-points) (registry, licence, version start).

**Size targets** are not guessed: phase 0 measures, phase 2b sets the budgets in the size table (section 9.1), and a script enforces them.

The portability inventory (what is ported from where) is [appendix A](#appendix-a-portability-inventory).

**Counts (schema is the source of truth; the coverage test asserts them).** 102 methods, 26 `EventKind`s, 27 `Subscription` variants (24 lifecycle + 3 parameterised: `pane.output_matched`, `pane.agent_status_changed`, `pane.scroll_changed`), 19 `EventMatch` variants, 63 result tags, 78 params types.

## Design intent inherited from atalaya

atalaya-bridge's design intent (measured wire facts W1-W6, client principles P1-P8) is adopted in [HERDR-ADR-0016](../decisions/HERDR-ADR-0016-design-intent-inherited-from-atalaya.md); atalaya's own open work is out of scope. Mapping table: [appendix B](#appendix-b-inherited-intent).

## 1. Goals and non-goals

**Goals.** (G1) Every one of the 102 methods callable with typed params and typed results, proven by a generated coverage test. (G2) One copy of the herdr client for hub, atalaya and scripts. (G3) Each consumer ships less than today, measured (section 9.1). (G4) Capability-scoped clients so a read-only consumer cannot write, by type and at runtime. (G5) Drift against a new herdr is detected by a command. (G6) Tests never touch a live herdr by default (hub ADR-0029).

**Non-goals.** No CLI wrapper. No reimplementation of herdr state (hub ADR-0004). No app domain (attention, sessions views, atalaya messaging). No Effect 3. No Python binding. No public npm publication.

## 2. Location, packaging, versioning, runtimes, dependencies

**Location: `packages/herdr` in omarchylab, name `@homelab/herdr`, private.** → [HERDR-ADR-0001](../decisions/HERDR-ADR-0001-library-scope-and-location.md)

| Option | For | Against | Verdict |
|---|---|---|---|
| A. `packages/herdr` in omarchylab | Beside its first consumer and its docs; one change moves library + hub | Hub image context is `hub/` only (`compose.yaml:52-53`); atalaya is another repo | **Chosen** |
| B. Inside the hub | No packaging | Not reusable | Rejected |
| C. Inside atalaya's pnpm workspace | Origin | Hub depends on another repo (what hub ADR-0003 avoided) | Rejected |
| D. Own repo `homelab/herdr` | Own CI, versioning | Two-repo churn while the API moves | **Later** (`git subtree split` after phase 6) |

**Consumption.** → [HERDR-ADR-0011](../decisions/HERDR-ADR-0011-consumer-migration.md)
- Image and CI: the hub depends on `hub/vendor/homelab-herdr-<version>.tgz` (`bun pm pack`), exact version, sha256 recorded in `hub/vendor/SHA256SUMS`. The hub `Containerfile` gains `COPY vendor ./vendor` before `bun install --frozen-lockfile --production` (today it copies only `package.json bun.lock`, `Containerfile:12-13`); `.dockerignore` must not exclude `vendor/`.
- Freshness: mise task `herdr:pack` builds `dist`, packs, copies the tarball and rewrites `SHA256SUMS`; the gate reruns it and fails if the checksum differs (stale tarball).
- Inner loop: `bun link` (or `"@homelab/herdr": "file:../../packages/herdr"` in a local, uncommitted override) for edit-run cycles; the tarball is only for the image and the committed lockfile.
- Phase 7: GitLab package registry; fallback if the registry is not enabled: the same tarball attached as a release asset of `homelab/omarchylab`, installed by URL with an integrity hash.
- Lockfile: `packages/herdr` has its own `bun.lock` (the root has no workspaces).

**Build.** Source TypeScript with `erasableSyntaxOnly`; ships `dist/*.js` + `.d.ts` because Node refuses to strip types in `node_modules`. `tsc` 7.0.2, no bundler. → [HERDR-ADR-0012](../decisions/HERDR-ADR-0012-runtime-targets-and-build-output.md)

**Runtimes.** Bun 1.4.4 (hub), Node >= 22.18 (atalaya pins >= 24). No `Bun.*` in `src/`; CI runs the suite on both.

**Versioning (protocol-tied semver).** `package.json` carries `"herdr": { "protocol": 22, "schemaVersion": 1, "testedWith": "0.9.5" }`, exported as `PROTOCOL`, `SCHEMA_VERSION`, `TESTED_HERDR`. Protocol change or removed/renamed/narrowed API = major; added methods/events = minor; else patch. `CHANGELOG.md` names the herdr version. → [HERDR-ADR-0009](../decisions/HERDR-ADR-0009-schema-drift-and-protocol-tied-versioning.md)

**Dependency policy.** Exact pins only, each released at least 14 days before it is adopted; `scripts/check-pins.ts` (gate) rejects ranges and too-new versions using `npm view <pkg> time`. → [HERDR-ADR-0015](../decisions/HERDR-ADR-0015-dependency-policy-and-size-budget.md)

| Entry / role | Package | Pin | Released | 14 days old on |
|---|---|---|---|---|
| peer (optional) of `/effect`; dev | `effect` | 4.1.2 (hub pin) | 2026-11-02 | 2026-11-16: phase 6a starts after this date |
| dev | `typescript` | 7.0.2 (hub pin) | 2026-07-08 | ok |
| dev | `@types/bun` | 1.4.4 (hub pin) | 2026-10-23 | 2026-11-06 |
| dev | `@types/node` | 22.20.5 | 2026-10-01 | ok |
| docs tooling (npx, not a dependency) | `likec4` | 1.60.0 | 2026-10-15 | ok |

Runtime dependencies: none for any entry (only `node:*`). TypeDoc is dropped (the generated `docs/api/*.md` is the reference).

## 3. Layered design

→ [HERDR-ADR-0003](../decisions/HERDR-ADR-0003-layering-and-entry-points.md), [HERDR-ADR-0004](../decisions/HERDR-ADR-0004-promise-core-and-effect-client.md)

```
packages/herdr/
  README.md  LICENSE  NOTICE.md  CHANGELOG.md  package.json  bun.lock  tsconfig.json
  schema/herdr-api.schema.json  schema/herdr-version.json
  gen/                     generator (ported from atalaya), `bun gen/index.ts`
    capabilities.ts        hand-kept: method -> class + note (section 4)
    method-result-map.ts   hand-kept: method -> result tag + source (section 4.2)
    overrides.ts           hand-kept: method -> { requiredTimeoutPath, returns } (section 3.6)
  src/
    constants.ts           every literal as `as const` objects: env names, paths, timeouts, texts, TOKEN_NAME_PATTERN
    generated/             OUTPUT of gen/ (committed)
    wire/                  layer 1: connection, line-splitter, envelope, id, errors, rpc, socket-path, protocol-policy
    client/                layer 2: connect(), namespace tree, scoped clients, subscribe, watch, held connections, async-queue
    effect/                Effect entry: Herdr service, Layers, tagged errors, Stream subscribe, watchPaneSet
    drift/                 inventory, drift, schema-source (pure)
    test-kit/              createFakeHerdr (node:net), default replies, request checker
    index.ts read-only.ts admin.ts effect.ts drift.ts test-kit.ts schema.ts   (one file per subpath export; dist/ is their compiled tree, plan 9.1)
  bin/herdr-drift.js        Node-run shim: spawns the herdr CLI, calls dist/drift/cli.js
  contract/herdr-22/       recorded goldens (confirm generated defaults)
  examples/*.ts            source of the README snippets (section 7)
  rules/                   dependency-cruiser + ast-grep templates (layers; consumer-single-adapter.dependency-cruiser.cjs: only one consumer adapter file imports @homelab/herdr, HERDR-ADR-0016 P7)
  scripts/                 check-pins.ts, check-size.ts (+ size-constants.ts, size-measure.ts), rewrite-dts.ts (build), check-readme.ts, check-layers.ts (+ import-specifiers.ts)
  test/  test/types/       bun:test (also node --test over dist); negative type fixtures
  docs/architecture/       this plan, README, c4/
  docs/decisions/          HERDR-ADR-0001..
```

**Dependency rule** (`rules/layers.dependency-cruiser.cjs`; phase 1b implements it as data in `rules/layers.ts` checked by `scripts/check-layers.ts`, with no dependency; the table can move to dependency-cruiser later): `generated <- wire <- client <- effect`; `test-kit` imports `wire` and `generated` only; nothing imports `test-kit` except tests; only `effect/` imports `effect`. All literals live in `src/constants.ts`; comparisons use generated `Method`, `EventKind`, `SubscriptionType`, `ResultTag`, `AgentStatus` and the hand `WatchKind` objects, never string literals.

### 3.1 Wire (layer 1)

NDJSON over a unix socket. `rpc`: one connection per request (hub ADR-0022), destroyed on every exit path. Measured wire rules (HERDR-ADR-0016): no id-correlation or pipelining layer; an error envelope with `id:""` is accepted as the reply; the runtime never spawns `herdr`; an unknown push `event` becomes `UnknownFrame` (counted via `onUnknown`, never thrown). Subscriptions and held connections (3.6) each own one dedicated connection. Errors: `HerdrError` (server envelope: `code`, `message`, `method`), `HerdrTransportError` (connect/timeout/abort/malformed, `cause`, `isTimeout`), `ProtocolMismatchError` (`expected`, `actual`), `UnsupportedByServerError` (`method`, `capability`).

`connect()` pings once, applies the protocol policy (`exact` default, `minimum` optional) and **keeps `pong.capabilities`** (`ServerCapabilities`, `herdr-schema.json:10428-10451`: `ssh_agent_registration`, `surface_interest`, `live_handoff`, `health_check`...) as `client.capabilities`. A method gated by a capability throws `UnsupportedByServerError` before sending when the server lacks it; the gate table is part of `gen/overrides.ts`.

### 3.2 Generator

→ [HERDR-ADR-0002](../decisions/HERDR-ADR-0002-generate-the-client-from-herdrs-published-schema.md)

| Piece | Status | Output |
|---|---|---|
| `ts-type.ts`, `emit-params/results/events/errors.ts` | ported | type-only wire shapes |
| new `emit-method-table.ts` | new | **one** runtime table `METHODS: { name, class, result, ns }[]`; `Method`, the capability sets and the namespace paths are all derived from it (no triple tables) |
| new `emit-names.ts` | new | `Method`, `EventKind`, `SubscriptionType`, `ResultTag`, `AgentStatus` as `as const` objects that `satisfies` the unions |
| new `emit-namespaces.ts` | new | the nested client **type** per capability class (`ReadOnlyClient`, `PromptClient`, `Client`, `AdminClient`) and the `EffectClient` mapped type |
| new `emit-defaults.ts` | new | one schema-valid default result per method, built from the result schema (instance generator) |
| new `emit-shapes.ts` | new | a small params shape table for the fake's request checker (required keys, types, enums) |
| new `emit-docs.ts` | new | `docs/api/methods.md` and `docs/api/events.md` |

Schema constructs the generator must handle, each with a fixture test in `test/gen/`: refs against the bundle root (`#/schemas/<x>/$defs/<T>`); the same definition in 2 to 3 bundles (`PaneInfo`, `WorkspaceInfo`, `EventData`, `LayoutNode`), emitted once per bundle with a namespaced name and deduplicated when structurally equal; recursive `LayoutNode`; 20 `additionalProperties` maps with `propertyNames` patterns; nullable type arrays (`["integer","null"]`); untagged unions (`PopupSize`, `SubscriptionEventData`); `default` values (doc comment only); shared params types (78 types for 102 methods: `EmptyParams` x10, `PaneTarget` x5...); `uint64` as `number` with a doc note.

Wire shapes are **plain TS types** (erased). Runtime validation in the core is limited to the envelope and push-line shape; `/effect` reuses it (no second decoder).

### 3.3 Core client (Promise)

`connect(options?)` → `Client`: namespace tree for classes R-meta, R-content, W, I, H, L, C (section 4), `call(method, params)`, `events.subscribe`, `watch`, `hold`, `capabilities`, `close()`. Options: `socketPath`, `timeoutMs` (10 s from `constants.ts`), `protocolPolicy`, `onCall` hook (`{ method, durationMs, outcome }`).

The namespace tree is built **once, eagerly, from the allow-list** by a small loop (no Proxy, no getters); the library does not import the generated `METHODS` table (plan 9.1 step 2). This is honest about size: every client carries the name table once. A tree-shakeable path is not offered in 1.0; if phase 2b measurement shows the table matters for a consumer, standalone functions (`@homelab/herdr/methods`) are added as a minor.

### 3.4 Capability-scoped clients

→ [HERDR-ADR-0005](../decisions/HERDR-ADR-0005-capability-scoped-clients.md)

| Entry | Classes | Notes |
|---|---|---|
| `connectReadOnly()` (`/read-only`) | R-meta + L | Default set. Terminal content (R-content) only with `{ content: true }` |
| `connectReadOnly({ methods })` | exactly the listed methods | runtime-only filter; the type stays `ReadOnlyClient`; long-poll methods are excluded unless listed |
| `connectReadOnly({ preset: Presets.SessionsReader })` | `session.snapshot`, `agent.list`, `agent.get`, `pane.get`, `pane.list` | named preset with its own small generated type (sessions allow-list, `src/contexts/sessions/adapters/driven/constants.ts`, hub ADR-0026) |
| `connectPrompt()` | R-meta + `agent.prompt` | hub voice path |
| `connect()` (`.`) | R-meta, R-content, W, I, H, L, C | the README zero-config entry; **no** D, S, X |
| `connectAdmin()` (`/admin`) | all 102 | D (close/remove/unlink/uninstall), S (server control), X (spawn/execute) |

Enforcement: the type has no members outside its classes (flat generated types, no tuple-narrowing machinery); a runtime allow-list check before sending; a test asserting `fake.receivedMethods()` ⊆ allowed set; negative type fixtures in `test/types/*.ts` compiled by `tsc --noEmit` in the gate (`// @ts-expect-error` must hold); ast-grep template `herdr-writes-only-in-adapter`.

`watch()` exists on read-only clients and fails at construction if `session.snapshot` is not allowed.

Effect: `Herdr.layerReadOnly(...)`, `Herdr.layerPrompt()`, `Herdr.layer(...)`, `Herdr.layerAdmin(...)` providing `HerdrReadOnly`, `HerdrPrompt`, `Herdr`, `HerdrAdmin`.

### 3.5 Domain model (deferred)

→ [HERDR-ADR-0006](../decisions/HERDR-ADR-0006-domain-model-separate-from-wire-types.md)

No consumer in phases 1 to 6 uses a model: the hub keeps its kernel mapping (`hub/src/shared/infra/herdr/mappers.ts`). `/model` is built in **phase 7** with atalaya's reducers as its first consumer and acceptance test. Shape when built: `model/entities.ts` (pure readonly `Pane`, `Agent`, `Tab`, `Workspace`, `Worktree`, `Snapshot`, branded ids; no wire import) and `model/from-wire.ts` (`fromSnapshot`, `applyEvent`), the **only** model file allowed to import `generated`. Rule: `generated <- model/from-wire.ts <- model/entities.ts` is forbidden in the other direction.

### 3.6 Subscriptions, long-poll and held connections

→ [HERDR-ADR-0007](../decisions/HERDR-ADR-0007-subscriptions-and-long-poll-design.md)

**Push frames.** `PushFrame = EventFrame | SubscriptionEventFrame`, discriminated on the outer `event`:
- `EventFrame`: `{ event: EventKind, data: EventData }` from the 24 lifecycle subscriptions;
- `SubscriptionEventFrame`: `{ event: "pane.output_matched" | "pane.agent_status_changed" | "pane.scroll_changed", data: SubscriptionEventData }` from the 3 parameterised ones.
The full mapping (26 `EventKind` -> subscription type -> `EventMatch` variant -> frame shape) is generated into `docs/api/events.md`; the coverage test asserts:
- every subscription type maps to exactly one frame kind;
- 7 kinds are **not awaitable** with `events.wait` (no `EventMatch`): `workspace_metadata_updated`, `workspace_reordered`, `worktree_created`, `worktree_opened`, `worktree_removed`, `pane_updated`, `layout_updated`;
- `pane_output_changed` has no subscription type (reachable only through `events.wait`);
- `pane.output_matched` and `pane.scroll_changed` have no `EventKind`;
- `pane_agent_status_changed` exists as both an `EventData` and a parameterised `SubscriptionEventData` shape; both are decoded, one normaliser maps them to one `AgentStatusChange`.

**subscribe.** `events.subscribe(specs, { signal, ackTimeoutMs, queue })` → `Subscription` (`AsyncIterable<PushFrame>`, `close()` destroys). Id-matched ack, malformed line = typed failure, server close = `SubscriptionEnded`. Queue default unbounded; `queue: { max, overflow: Overflow.DropOldest | Overflow.Fail }`.

**watch.** subscribe → ack → snapshot → emit `{ kind: WatchKind.Live, snapshot }` → frames. `SessionSnapshot` has no revision field, so ordering rule is: frames received between ack and snapshot reply are **buffered and replayed after the snapshot** through the consumer's fold, which must be idempotent (documented; `applyEvent` is). Any close = resubscribe + resnapshot, backoff 1 s doubling to 30 s, reset after a stable period (hub ADR-0022), injectable.

**Long-poll.** `gen/overrides.ts` lists per method `{ requiredTimeoutPath, timeoutBounds?, returns? }`; `emit-namespaces` makes that path required in the library params:

| Method | Timeout path | Notes |
|---|---|---|
| `agent.wait`, `events.wait`, `pane.wait_for_output` | `timeout_ms` | rpc timeout = `timeout_ms + LONG_POLL_MARGIN_MS` |
| `agent.prompt` | `wait.timeout_ms` (`AgentPromptWaitOptions`) | only when `wait` is given |
| `agent.start` | `timeout_ms`, bounds > 3000 and <= 300000 (`herdr-schema.json:1359`) | runtime check before sending |
| `events.subscribe` | — | `returns: Subscription` (not the ack result) |

The timeout reply shape (error code vs result) is pinned by a golden in phase 5b; until then the fake header keeps F6 OPEN and the library treats both as `HerdrTransportError { isTimeout }`. A timeout is not proof of non-delivery: never resend blindly. Tests: per long-poll method, rpc timeout equals `timeout_ms` + margin, and omitting the timeout is a compile error (negative type fixture).

**Held connections (class C).** Four methods are scoped to the API connection that sent them: `server.ssh_agent.register` ("Registration lasts until this API connection closes", `herdr-schema.json:3887`, capability `ssh_agent_registration` at `:10446`), `client_shell.surface.set` (surface interest lease, `:1699`, capability `surface_interest` at `:10385`), `client.window_title.set`/`clear` (per requesting client). On per-request `rpc` they would end at once. API:

```ts
const held = await herdr.hold()            // one dedicated connection
await held.client.window_title.set({ ... }) // only C methods on this object
await held.close()                          // ends registration / lease / title
```

`hold()` returns a `Held` with `close()` and `Symbol.asyncDispose`; C methods are **not** on the per-request namespace tree. Tests: the fake sees one connection stay open across calls and sees the close.

### 3.7 Effect client

`/effect` reuses the core's `rpc`, `subscribe` and `hold`; it only maps errors and interruption (no second Schema decoder; the hub's `wire.ts` Schemas are dropped). Namespaces come from the generated `EffectClient` mapped type plus one runtime wrapper over the core tree. `Herdr.layer({ socketPath?, timeoutMs })` (no default timeout). Error mapping:

| Core (Promise) | Effect `_tag` | Fields |
|---|---|---|
| `HerdrError` | `HerdrRefused` | `method`, `code`, `message` |
| `HerdrTransportError` | `HerdrUnavailable` | `cause`, `isTimeout` |
| `ProtocolMismatchError` | `ProtocolMismatch` | `expected`, `actual` |
| `UnsupportedByServerError` | `HerdrUnsupported` | `method`, `capability` |
| `SubscriptionEnded` | `HerdrUnavailable` | `cause` |
| fiber interruption | — | destroys the connection |

## 4. API coverage

Classes are hand-kept in `gen/capabilities.ts` with a one-line note per method; the generator fails on an unclassified method.

| Class | Meaning | Examples |
|---|---|---|
| **R-meta** | read structure | `*.list`, `*.get`, `session.snapshot`, `pane.layout`, `pane.process_info`, `ping` |
| **R-content** | read terminal content | `pane.read`, `agent.read`, `pane.selection.read` |
| **W** | change UI/state | `*.rename`, `*.focus`, `pane.split`, `pane.copy_motion`, `pane.copy_search` (copy-mode state; W until probed) |
| **I** | input injection | `pane.send_*`, `agent.send_keys`, `agent.prompt` |
| **H** | hook reporter | `pane.report_*`, `*.report_metadata` |
| **L** | long-poll / stream | `agent.wait`, `events.wait`, `pane.wait_for_output`, `events.subscribe` |
| **C** | connection-bound | `server.ssh_agent.register`, `client_shell.surface.set`, `client.window_title.set/clear` |
| **X** | spawns/executes | `agent.start`, `command.invoke`, `plugin.action.invoke`, `plugin.link`, `plugin.enable`, `integration.install`, `pane.edit_scrollback`, `pane.link.activate` |
| **D** | destructive | `*.close`, `worktree.remove`, `plugin.unlink`, `integration.uninstall` |
| **S** | server control | `server.stop`, `server.live_handoff`, `server.reload_*` |

The per-domain table is **generated** (`docs/api/methods.md`: method, params type, result tag, class, phase); no hand tally.

### 4.1 Coverage test

`test/coverage.test.ts`, inputs generated: for every method in the committed schema there is a `METHODS` row, a class, a result mapping, a default reply that validates against its result tag, and a params shape. Counts equal 102/26/27/19/63.

### 4.2 Method -> result mapping

The schema's `request.oneOf` carries only method + params; nothing links a method to its result tag. Only 30 of 102 match a tag by name (`pane.list` -> `pane_list`); the rest are irregular (`ping` -> `pong`, `workspace.create` -> `workspace_created`, `agent.wait` -> `wait_matched`, many -> `ok`).

| Step | Source | Methods |
|---|---|---|
| a | atalaya `gen/method-result-map.ts` (25) + name matches (30), deduplicated | ~55 |
| b | herdr docs/source, or one recording on a scratch herdr for safe methods | ~31 |
| c | destructive / server-control (`server.stop`, `server.live_handoff`, `workspace.close`, `plugin.unlink`...): **documentation only**, never probed | ~16 |

Each row records its source (`seed`, `name`, `docs`, `recorded`). `LOOSE` is allowed only with a reason string; the generator fails on an unmapped method or a reasonless `LOOSE`. The fake's replies are asserted against the mapping.

## 5. Test kit and contract policy

→ [HERDR-ADR-0008](../decisions/HERDR-ADR-0008-test-kit-and-contract-test-policy.md)

- `createFakeHerdr({ protocol?, socketPath?, capabilities? })` on `node:net`: `reply`, `replySequence`, `fail`, `silent`, `rawReply`, typed `push`, `closeSubscribers`, `receivedMethods`, `requests`, `subscriberCount`, `connectionCount`, `holdPushes`, `splitAck`, `strayLine`, `stop`. Ported from the hub fake (`test/fakes/fake-herdr-server.ts`).
- Defaults: every method answers with the generated default reply (3.2); goldens in `contract/herdr-22/` only confirm. Requests are checked against the params shape table; a bad request gets an error envelope (`invalid_params`).
- `capabilities` option advertises or omits server capabilities in `pong`.
- Measured herdr behaviour (HERDR-ADR-0016 W1-W6): close after each non-subscribe response; `id:""` + close for an unparseable line; no history replay on subscribe; `invalid_params` for a per-pane subscription without `pane_id`; `push` of an unknown kind; `api.schema` returns `{}`. Each has a test in `test/test-kit`.
- Protocol facts F1-F6 from the hub fake header carried; F4 (unwrapped pushes) and F6 (unknown method / long-poll timeout code) pinned by goldens in phase 5b, or stay marked OPEN.
- Live runs follow the hub mechanism: `test/contract/*.contract.ts`, excluded from `bun test`, run by an explicit `bun run test:contract` that needs the owner's OK each time (hub ADR-0029), guarded additionally by `HERDR_LIVE=1` and a scratch session. Reads, plus writes only on panes the test created.
- Socket tests run x3 in the gate.

## 6. Schema drift

→ [HERDR-ADR-0009](../decisions/HERDR-ADR-0009-schema-drift-and-protocol-tied-versioning.md)

| Step | Command | Result |
|---|---|---|
| Capture | `bun run capture` | schema + `herdr-version.json` |
| Drift | `herdr-drift` | protocol, version, methods, tags, kinds, subscription types, field shapes, unmapped methods; exit 0/1/2/3 |
| Connect | `connect()` / `Herdr.layer` | `ProtocolMismatch` with expected/actual |
| Upgrade | capture → generate → coverage → classify/map → contract (fake + opt-in live) → CHANGELOG + bump | |

Drift runs in the owner's delivery gate (mise task), not CI.

## 7. Documentation

→ [HERDR-ADR-0014](../decisions/HERDR-ADR-0014-executable-docs.md)

`examples/*.ts` are the source of truth for README code. The README includes them by marked regions (`<!-- example:script -->`); `scripts/check-readme.ts` fails if the README text differs from the region. Examples compile in CI; the ones marked `run` execute against `createFakeHerdr()`. Helper names used in snippets (`metrics`, `render`, `apply`) are declared in `examples/_stubs.ts`. Generated references: `docs/api/methods.md`, `docs/api/events.md`. This plan, the C4 model in `c4/` (`npx -y likec4@1.60.0 validate .`), ADRs in `../decisions/`.

## 8. Migration

→ [HERDR-ADR-0011](../decisions/HERDR-ADR-0011-consumer-migration.md)

**Hub** (hub slice S8):

| Before | After |
|---|---|
| `src/shared/vendor/atalaya/**` (13 files, NOTICE) | deleted |
| `src/shared/infra/herdr/{herdr-client,wire,protocol-policy,socket-path}.ts` | deleted; `Herdr` from `@homelab/herdr/effect` |
| `src/shared/infra/herdr/mappers.ts` | kept (kernel `AgentStatus`) |
| `src/shared/kernel/herdr-errors.ts` | re-export of the library's tagged errors |
| attention `herdr-agent-fleet.ts` generation loop | `watchPaneSet`; FleetChange mapping stays |
| sessions `herdr-agent-sessions.ts` `ReadRequest` + `driven/constants.ts` allow-list | `HerdrReadOnly` with `Presets.SessionsReader` |
| `test/fakes/fake-herdr-server.ts`, `test/shared/herdr-client.test.ts` | `createFakeHerdr`; client tests deleted (now library tests) |
| `test/shared/herdr-mapping.test.ts` | kept (tests `mappers.ts`) |
| `Containerfile` | `COPY vendor ./vendor` before `bun install` |

**Hub ADR changes** (copied into the hub in phase 6b, **not edited here**):

| Hub ADR | Change |
|---|---|
| hub ADR-0030 (new; last hub ADR is 0029) | "Depend on the extracted @homelab/herdr package"; **supersedes ADR-0003** |
| hub ADR-0012 | protocol policy comes from the library (`exact`) |
| hub ADR-0022 | watch/backoff helper comes from the library |
| hub ADR-0029 | herdr fake comes from `@homelab/herdr/test-kit` |

Also: hub `docs/delivery.md` S8 row; repo-root README entry for `packages/`.

**atalaya-bridge** (phase 7, its own ADR): replace `gen/`, `generated/`, `src/{transport,protocol,client,events,services}`, `src/herdr-client.ts`, drift files; keep `frame-decoder.ts`, adapters, `informer.ts`, `watch-set.ts`; `RpcObserver` -> `onCall`; reducers move into `/model`.

**Legacy Python**: stays on the CLI until retired.

## 9. Delivery phases

Each slice follows the hub pattern: Opus-low architect spec → Haiku implement (each < 100k tokens) → Haiku check x3 → Sonnet review x3 → fix → Sonnet gate.

**Parallel build on locked interfaces** ([HERDR-ADR-0017](../decisions/HERDR-ADR-0017-interfaces-locked-before-parallel-implementation.md)). The contract files (one `types.ts` per layer, the error classes, the contract section of `constants.ts`) were written first and are read-only for every lane. Every unbuilt function is a typed stub that throws `NotImplementedError`. Contract map, lane ownership (disjoint paths), acceptance and stub strategy per lane: [contracts.md](contracts.md). Lane graph:

```
now:        P2a (review fixes) ──► P5a (takes over the fake files)
            P2b (slice P2b-1 first: tree builder, allow-list), P3, P4a, P4b, P5c   in parallel (P4b on P4a's stubs)
2026-11-06: A0 (@types/bun pinned; every test dir type-checked)
2026-11-16: amendment A1 (effect pinned; Effect types; effect/services.ts stubs) ──► P6a
            all lanes integrated ──► 6b hub migration (S8)
```

Gate for every lane, in addition to its row: `bun run typecheck && bun run typecheck:types && bun test && bun run lint:layers`.

| Phase | Delivers | Acceptance (command) |
|---|---|---|
| 0 Baseline | measurement study (research skill) on a clean checkout + a generator prototype emitting only `METHODS` | numbers in section 9.1 filled; `bun run study:size` reproduces them |
| 1a Schema + gen port | package.json/tsconfig/LICENSE/NOTICE, 0.9.5 capture, ported gen with path params, construct fixtures | `bun gen/index.ts && git diff --exit-code`; `bun test test/gen`; `bun scripts/check-pins.ts` |
| 1b New emitters | method table, names, namespaces types, defaults, shapes, docs, `constants.ts`, layer rule | `bun gen/index.ts && git diff --exit-code`; `bun run lint:layers` (layers + consumer-single-adapter template self-test); every file in `src/generated` starts with the generated banner (P2); `scripts/check-entries.ts`: each `package.json` export maps to a named consumer (P8) |
| 2a Wire + rpc + fake | wire/, `rpc`, `connect()` with capabilities, minimal node:net fake (reply/fail/silent/rawReply/receivedMethods), ported hub rpc/connect tests | `bun test test/wire test/connect` (incl. connection reuse fails, `id:""` rejects without hanging, no `child_process` import) and `node --test "dist-test/test/wire/**/*.test.js" "dist-test/test/connect/**/*.test.js"` green (Node 22 does not take a directory argument; the compiled tree keeps `test/` under `dist-test/`) |
| 2b Namespaces + scoped clients | namespace tree, `/read-only`, `/admin`, `connectPrompt`, classes, examples 1 and 3 | `bun test test/scoped`; `tsc -p test/types`; `bun run check:size` (budgets set here; the no-leak rows pass after plan 9.1 steps 2 and 3) |
| 3 Result map | complete mapping (4.2), coverage test, `docs/api/*.md` | `bun test test/coverage.test.ts` |
| 4a Subscribe + long-poll | subscribe, push frames, overrides, long-poll typing; ported hub subscribe tests | `bun test test/subscribe test/long-poll` (incl. unknown-kind frame → `UnknownFrame`); `tsc -p test/types` |
| 4b Watch + held | watch with replay rule and backoff, `hold()` for class C | `bun test test/watch test/held` (incl. snapshot removal fails the suite, `watchPaneSet` follows created/closed panes, frames between ack and snapshot, overflow policy, held connection stays open then closes) |
| 5a Full fake | full fake from the hub fake, request checker, default replies, `capabilities` option | `bun test test/test-kit` x3 |
| 5b Goldens | goldens from a scratch 0.9.5 (owner OK), F4/F6 pinned or OPEN | `bun run test:contract` (owner-run) |
| 5c Drift | drift CLI with shapes and version | `bun test test/drift.test.ts` (incl. no herdr on PATH → 3) |
| 6a `/effect` | Effect entry, error mapping, `watchPaneSet` | `bun test test/effect`; hub tests unchanged and green against a local `bun link` |
| 6b Hub migration (S8) | table in section 8; hub ADR-0030 copied | hub `bun test` green; image builds from tarball; `herdr:pack` checksum matches; size table hub rows met |
| 7 Registry + atalaya + `/model` | registry job (fallback: release asset), atalaya switch, `/model` with atalaya reducers | in a clean atalaya checkout `pnpm install` resolves the exact version from the registry (or asset) and `node --test` is green |
| 8 Docs | examples complete, CHANGELOG 1.0, ADR statuses | `bun scripts/check-readme.ts`; ADRs whose code landed moved to accepted |

### 9.1 Size table

The library ships compiled, unbundled ESM with declarations (`dist/`, built by `tsc -p tsconfig.build.json`; HERDR-ADR-0012). A consumer's bundler or Node loads only the modules it reaches. Sizes are measured on `dist/`, never on `src/`. The gate is `bun run check:size`: it runs `bun run build`, then `scripts/check-size.ts`, which measures each row and fails when a row is over its budget or contains a forbidden input (the no-leak check, HERDR-ADR-0015).

Command per row (bun 1.4.4): `bun build <file> --minify --target node --external effect --splitting --metafile <meta>`. The static closure of the entry counts toward the row; chunks reached only through a dynamic `import()` count toward the lazy row. Scenarios import `@homelab/herdr/...` through a temporary `node_modules` symlink to the package, so they measure what a consumer gets.

Bytes, minified. "Before (src)" is the study baseline (2026-11-02, package exports still pointing at `src/`). "After part 1" is `dist/` after the build change (steps 5 to 7). "Now" is `dist/` after steps 2 and 3 (the client slice) and the lazy-streams chunk. "Budget" is measured plus about 10 %, rounded up to 100 B, and never above the owner's ceiling (the last column). Step 4 (the `constants/` split) is deferred, see HERDR-ADR-0015.

| Row | Before (src) | After part 1 (dist) | Now (dist) | Budget | Owner ceiling | Status |
|---|---|---|---|---|---|---|
| dist `.` (all exports) | 42,247 | 42,078 | 26,887 | 29,600 | 36,000 | ok |
| dist `/read-only` | 37,809 | 37,640 | 18,691 | 20,600 | 24,000 | ok |
| dist `/admin` | 37,291 | 37,122 | 15,561 | 17,200 | 26,000 | ok |
| dist `/effect` | 4,358 | 4,198 | 4,198 | 4,700 | — | ok |
| lazy chunks of `.` (the streams chunk) | none | 0 | 7,672 | 8,500 | 9,000 | ok |
| scenario a (read-only, 1 method) | 37,572 | 37,403 | 17,513 | 19,000 | 19,000 | ok |
| scenario a-preset (read-only preset, no `Method`) | 37,612 | 37,443 | 14,221 | 15,000 | 15,000 | ok |
| scenario b (fleet: snapshot, watchPaneSet, toTaggedError) | 40,908 | 40,739 | 22,158 | 24,400 | 30,000 | ok |
| scenario c (script: connect, 2 methods) | 37,410 | 37,241 | 15,091 | 16,600 | 22,000 | ok |

Targets (owner requirement, 2026-11-02): all owner ceilings are met by "Now". The largest removed parts were `generated/method-table.js` (the `METHODS` table, no longer imported by the library), the entry lists that were not the connect function's own, and the streams code, which now loads on first use. `Method` stays public API, so the `names/method.js` object (about 5 KB in the full entry) is still in `.` and `/read-only`. The budgets are a regression guard: a budget moves down when the code shrinks, and an increase needs a HERDR-ADR-0015 note.

No-leak check (`scripts/check-size.ts`): fails a production row or a scenario that contains test-kit (`/test-kit`), generated test data (`/generated/test-data/`), drift data (`/generated/drift/`), `METHODS` (`/generated/method-table`), the entry lists (`/generated/entry-methods`) or `child_process`. `/read-only` and the read-only scenarios also refuse `/admin.js`, `connect-admin` and `/effect`. The `.` entry is held to the same rule: `src/index.ts` does not export `METHODS`.

Known gaps of the build as shipped: `dist/generated/test-data/*.js` ships in the tarball, because `generated/index.ts` re-exports `DEFAULT_RESULT` and `PARAMS_SHAPE`; no production row or scenario contains it (tree-shaken, checked by the no-leak test). Step 4 (`constants/` split) is deferred (HERDR-ADR-0015). The emitted `.js` keeps its comments (`removeComments: false`, so the JSDoc reaches the `.d.ts` files): about 25 % more text in `dist/*.js` than with the comments removed (247,559 B against 197,071 B). The pre-existing `bin/herdr-drift.ts` moved to `bin/herdr-drift.js`; the drift tests need `dist/`: `bun run test` builds it first (`pretest`); a bare `bun test` needs `bun run build` before it.

Working commands:

- `bun run build` (dist, then the `.d.ts` specifiers)
- `bun run check:size` (build, then the gate; exit 1 on an over-budget row or a leak)
- `bun scripts/check-size.ts --measure` (print the rows without enforcing; needs `dist/`)
- `bun run study:size` (hub and atalaya herdr code, unchanged)

Hub and atalaya rows are unchanged from the 2026-11-02 study (`docs/research/studies/2026-11-02-herdr-size-baseline`).

## 10. Decisions, risks

| ADR | Title | Governs |
|---|---|---|
| [HERDR-ADR-0001](../decisions/HERDR-ADR-0001-library-scope-and-location.md) | Library scope and location | 1, 2 |
| [HERDR-ADR-0002](../decisions/HERDR-ADR-0002-generate-the-client-from-herdrs-published-schema.md) | Generate the client from herdr's published schema | 3.2, 4 |
| [HERDR-ADR-0003](../decisions/HERDR-ADR-0003-layering-and-entry-points.md) | Layering and subpath entry points, zero-dependency core | 3, 3.3 |
| [HERDR-ADR-0004](../decisions/HERDR-ADR-0004-promise-core-and-effect-client.md) | Promise core and Effect client | 3.3, 3.7 |
| [HERDR-ADR-0005](../decisions/HERDR-ADR-0005-capability-scoped-clients.md) | Capability-scoped clients and the admin subpath | 3.4, 4 |
| [HERDR-ADR-0006](../decisions/HERDR-ADR-0006-domain-model-separate-from-wire-types.md) | Domain model separate from wire types (deferred) | 3.5 |
| [HERDR-ADR-0007](../decisions/HERDR-ADR-0007-subscriptions-and-long-poll-design.md) | Subscriptions, long-poll and held connections | 3.6 |
| [HERDR-ADR-0008](../decisions/HERDR-ADR-0008-test-kit-and-contract-test-policy.md) | Test kit and contract-test policy | 5 |
| [HERDR-ADR-0009](../decisions/HERDR-ADR-0009-schema-drift-and-protocol-tied-versioning.md) | Schema drift and protocol-tied versioning | 2, 6 |
| [HERDR-ADR-0011](../decisions/HERDR-ADR-0011-consumer-migration.md) | Consumer migration and distribution | 2, 8 |
| [HERDR-ADR-0012](../decisions/HERDR-ADR-0012-runtime-targets-and-build-output.md) | Runtime targets and build output | 2 |
| [HERDR-ADR-0014](../decisions/HERDR-ADR-0014-executable-docs.md) | Docs are executable: README-first, examples compiled and run | 7 |
| [HERDR-ADR-0015](../decisions/HERDR-ADR-0015-dependency-policy-and-size-budget.md) | Dependency policy and size budget | 2, 9.1 |
| [HERDR-ADR-0016](../decisions/HERDR-ADR-0016-design-intent-inherited-from-atalaya.md) | Design intent inherited from atalaya: measured wire facts and client principles | 1, 3.1, 3.6, 5 |

**C4 views** ([c4/](c4/)): `1 · Context` (HERDR-ADR-0001, 0011), `2 · Containers` (0003, 0004, 0005, 0008, 0009), `3 · Components / Core client` (0002, 0005, 0007), `3 · Components / Effect client` (0004, 0007). No view: 0006 (deferred `/model` entry is shown in Containers), 0012 and 0015 (build output and policy are not C4 elements), 0014 (documents), 0016 (policy and rules, no element changes).

| Risk | Mitigation |
|---|---|
| Provenance of jsHerdrSDK (MIT only in package.json) | `LICENSE` + `NOTICE.md` chain; open question 2 |
| Weak typing until phase 3 | coverage test + reasoned `LOOSE` list |
| uint64 above 2^53 | documented; revisit if seen |
| Misuse of input/destructive methods | D/S/X only on `/admin`; JSDoc carries herdr skill safety rules |
| node:net fake timing | port hub tests first, x3 in the gate |
| Effect 4 churn | exact peer, bumped with the hub |
| `pane.output_matched` flood | bounded queue with explicit overflow policy |

## 11. Open questions and rejected review points

**Open questions for the owner.**
1. Registry: enable the GitLab package registry on `homelab/omarchylab` (fallback: release asset, section 2)?
2. Ask upstream (brooswit) to add a LICENSE, or rely on the package.json declaration?
3. Version start: `0.1.0` until phase 6b, then `1.0.0`?
4. May `pane.copy_motion` / `pane.copy_search` be probed on a scratch herdr to move them from W to R-content?

**Rejected or partly rejected review points (2026-11-02 review).**
- *Option B, tree-shakeable standalone functions now*: rejected for 1.0 (one honest eager table, 3.3); revisited if 2b measurement shows a need.
- *Probe `copy_motion`/`copy_search` live now*: not done (needs owner OK, hub ADR-0029); classed W conservatively, open question 5.
- *Keep `/model` in phase 4*: deferred to phase 7 instead of splitting it now, because no consumer before atalaya needs it.
- *Merge atalaya `informer.ts` into `watch()`*: rejected; it reconciles atalaya watcher state (app-specific), `watch()` covers only subscribe/snapshot/resubscribe (appendix A).
- *Pin-age check of hub pins*: done (table in section 2); `effect` 4.1.2 and `@types/bun` 1.4.4 are younger than 14 days today, so the library adopts them only from the dates listed.

## Appendix A. Portability inventory

Disposition: **P** portable as-is, **C** after the named change, **A** app-specific (stays).

### A.1 atalaya-bridge

| Module | Lines | Disp. | Change | Target |
|---|---|---|---|---|
| `gen/{index,schema,ts-type,emit-*}.ts` | ~330 | C | path params (`gen/schema.ts:27-31`), drop `#gen/*`, new emitters | `gen/` |
| `gen/method-result-map.ts` | 27 | C | 25 entries seed the mapping (4.2) | `gen/method-result-map.ts` |
| `generated/*` | 976 | C | regenerate from 0.9.5 | `src/generated/` |
| `schema/*` | — | C | recapture 0.9.5 | `schema/` |
| `src/transport/connection.ts` | 52 | C | take the hub copy | `src/wire/` |
| `src/transport/line-splitter.ts` | 15 | P | add tests | `src/wire/` |
| `src/transport/socket-path.ts` | 6 | C | explicit option, existence check | `src/wire/` |
| `src/transport/frame-decoder.ts` | 119 | A | watcher domain | stays |
| `src/protocol/{envelope,error,id}.ts` | 46 | P | add `ProtocolMismatchError` | `src/wire/` |
| `src/client/rpc.ts` | 67 | C | hub version; `onCall` | `src/wire/rpc.ts` |
| `src/client/typed.ts` | 8 | P | — | `src/generated/typed.ts` |
| `src/herdr-client.ts` + `src/services/*` | ~210 | C | replaced by generated tree | `src/client/` |
| `src/events/subscription.ts`, `async-queue.ts` | 81 | C | hub hardening, bound | `src/client/` |
| `src/reducers/*` | ~90 | C | name bug fix (`apply-event.ts:54-62`) | `/model` (phase 7) |
| `src/watcher/application/informer.ts` + `test/watcher/informer*.test.ts` | 232 + 524 | A | reconciles atalaya watcher state; tests inform the watch replay test | stays |
| `src/watcher/application/watch-set.ts` + `test/watch-set.test.ts` | 14 | A | pane-set derivation for atalaya; the hub's equivalent lives in `watchPaneSet` | stays |
| `test/watcher/fleet-source-contract.ts` | 52 | P (pattern) | second "one contract, two subjects" example | test-kit practice |
| `src/adapters/herdr-wire.ts` `wireTokensOf` + schema `propertyNames` `^[A-Za-z0-9_-]{1,32}$` | — | C | pattern -> `constants.ts` `TOKEN_NAME_PATTERN`; checked in the fake's request checker | `src/constants.ts` |
| `test/vendor/tab-recap-protocol.medium.test.ts` | 65 | C | protocol test of the vendored client | `test/wire` |
| `test/budget.json` | — | C | slow-test budget pattern for the gate | `test/budget.json` |
| `bin/herdr-drift.ts`, `src/{drift,inventory,schema-source}.ts` | ~230 | C | no `process.exit` in lib, shapes, version | `src/drift/`, `bin/` |
| `test/drift.medium.test.ts` | 133 | P | — | `test/drift.test.ts` |
| `test/client/rpc-observer.medium.test.ts` | 191 | C | fold into wire tests | `test/wire` |
| `ci/domain-types/*` | ~570 | A | extract the predicate only | `rules/` |
| `ci/dependency-cruiser.cjs`, `ci/boundaries.sh` | — | C | template | `rules/` |
| `rules/bridge-herdr-raw-only-in-adapter.yml` | — | C | generalise | `rules/` |
| `contract/core-v1/*` | — | P (pattern) | goldens + validator pattern | `contract/herdr-22/` |
| `test/messaging/herdr.contract.ts` | — | P (pattern) | one contract, two subjects | test-kit practice |
| `NOTICE.md` | — | C | rewrite chain | `LICENSE`, `NOTICE.md` |

### A.2 voice hub

| Module | Lines | Disp. | Change | Target |
|---|---|---|---|---|
| `src/shared/vendor/atalaya/**` | ~1230 | C | superseded | deleted after 6b |
| `src/shared/infra/herdr/herdr-client.ts` | 199 | C | lift `openSubscription` (52-127) into the core | `src/effect/`, `src/client/subscribe.ts` |
| `src/shared/kernel/herdr-errors.ts` | 26 | C | same `_tag`s and fields | `src/effect/errors.ts` |
| `src/shared/infra/herdr/wire.ts` | 101 | C | name maps -> generated; Schemas dropped (3.7) | `src/generated/names.ts` |
| `src/shared/infra/herdr/protocol-policy.ts` | 4 | C | policy as value | `src/wire/` |
| `src/shared/infra/herdr/socket-path.ts` | 8 | C | duplicate | deleted |
| `src/shared/infra/herdr/mappers.ts` + `test/shared/herdr-mapping.test.ts` | 15 | A | kernel mapping | stays |
| attention `herdr-agent-fleet.ts` 96-165 | ~70 | C | backoff injectable | `src/effect/watch.ts` + Promise twin |
| same file, FleetChange mapping | ~100 | A | attention domain | stays |
| sessions `herdr-agent-sessions.ts` `ReadRequest` | ~20 | C | -> `Presets.SessionsReader` | `src/client/read-only.ts` |
| `test/fakes/fake-herdr-server.ts` | 262 | C | node:net, scripted, typed push | `src/test-kit/` |
| `test/shared/herdr-client.test.ts` | 489 | P | split: rpc/connect -> 2a, subscribe -> 4a | `test/` |
| `test/attention/herdr-agent-fleet.test.ts` | 241 | C | watch cases move | `test/watch` |
| `test/contract/probe/fake-herdr.probe.ts` | 37 | C | opt-in live run | `test/contract/` |

## Appendix B. Inherited intent

Origins: delivery-handbook ADR-0037/0041 (2026-09-20, herdr 0.9.0, protocol 22), spine AD-5/AD-9/AD-10, `atalaya-bridge/AGENTS.md`, `NOTICE.md`. Decision: [HERDR-ADR-0016](../decisions/HERDR-ADR-0016-design-intent-inherited-from-atalaya.md).

| Intention | Origin | How the library embodies it |
|---|---|---|
| One request per connection; no correlation | ADR-0037 facts 1-2 (+ jsHerdrSDK 0.8.2) | 3.1 rule W1; the fake closes after each response; a reuse test |
| Subscribe = ack, then held stream | ADR-0037 facts 3-4 | 3.6, HERDR-ADR-0007; `splitAck` and `strayLine` tests |
| Unparseable request → `id:""` + EOF | ADR-0037 fact 5 | 3.1 rule W3; the fake emits the real shape; a no-hang test |
| Runtime never shells out to `herdr` | ADR-0037 dec. 1, AD-5, AGENTS.md:120 | rule P1; `node:child_process` banned in wire/client |
| Generate from the CLI schema; the socket gives `{}` | ADR-0037 fact 6, dec. 2 | HERDR-ADR-0002 |
| Generated output never hand-edited | AGENTS.md:95,106 | rule P2; banner check (phase 1b); regen + diff gate |
| Drift: "could not look" = 3, never 0 | `bin/herdr-drift.ts`, ADR-0037:207 | HERDR-ADR-0009; test with no herdr on PATH → 3 |
| Drift has no CI; the gap is declared | AGENTS.md:110-114 | HERDR-ADR-0009 retirement condition |
| Bumps are bounded and additive (20→22: +11/-0) | ADR-0037:91-105 | HERDR-ADR-0009 evidence + upgrade step |
| Unmapped method = typing gap | AGENTS.md:116, NOTICE.md:36 | already stricter: the build fails until classified (4.2) |
| Unknown event kind: surfaced, never guessed or fatal | ADR-0037 dec. 5, AD-9 | rule P3: `UnknownFrame` + `onUnknown`; fake `push` test |
| Envelope-only validation | ADR-0037 dec. 5, AD-9 | HERDR-ADR-0002 + reversal condition |
| Snapshot first: a subscription gives no present | ADR-0037:30-35, AGENTS.md:41 | rule W5; the fake replays no history; `test/watch` fails without the snapshot |
| 3 of 27 subscribable types are per-pane | AGENTS.md:45-47 | rule W6; `watchPaneSet` follows created/closed; the fake rejects a per-pane subscription with no `pane_id` |
| Conformist at the wire, ACL at the port | AD-10, ADR-0037 dec. 6 | HERDR-ADR-0001/0006; `rules/consumer-single-adapter.dependency-cruiser.cjs` |
| Split on a real consumer | ADR-0041 dec. 3, AGENTS.md:29,90 | HERDR-ADR-0003; `scripts/check-entries.ts` gate |
