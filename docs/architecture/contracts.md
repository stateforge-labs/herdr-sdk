---
id: HERDR-CONTRACTS
title: "@homelab/herdr: locked contracts and lane ownership"
status: proposed
date: 2026-11-02
summary: "The contract files every parallel lane builds on (P2a, P2b, P3, P4a, P4b, P5a, P5c, P6a, P6c, then 6b), who implements and who consumes each, and the files each lane may touch. Contract files are owned by no lane (HERDR-ADR-0017)."
---

# Contracts and lane ownership

> Decision: [HERDR-ADR-0017](../decisions/HERDR-ADR-0017-interfaces-locked-before-parallel-implementation.md). Plan: [section 10](plan.md#10-delivery-phases). Contract tests: `bun run typecheck:types` (`tsc -p test/types`).

## Rules

1. A **contract file** declares types and function types with JSDoc. It is read-only for every lane. It changes only through a contract amendment by the architect (HERDR-ADR-0017).
2. Every unbuilt function already exists as a **stub**: `export const f: ContractType = () => notImplemented('f', Lane.Px)` (`src/not-implemented.ts`). The owning lane replaces the stub body in place. The annotation `: ContractType` stays, so the compiler checks the implementation against the contract.
3. Factories that the client builds at connect time (`createSubscribe`, `createWatch`, `createHold`) return a function that throws when *called*. Building them never throws, so composing a client today is safe.
4. A lane that needs a contract change **stops and reports** (what, why, which consumers). It does not widen a type, add a cast or add a parallel type.
5. Results become precise in phase 3 through the generated `ResultByTag`/`METHOD_RESULT` names. No contract redefines a result type. `ResultOf<M>` (`src/wire/typed.ts`) improves by itself when P3 regenerates.
6. `src/generated/**` is output. Only P3 regenerates it (P2).

## Contract map

| Contract file | Defines | Implemented by | Consumed by |
|---|---|---|---|
| `src/constants.ts` (contract section) | `UNKNOWN_EVENT`, `PaneSetKind`, `DriftExitCode`, `SchemaReadKind`, `EffectErrorTag`, `McpToolName`, `WireFact`, `Lane`, `Overflow`/`WatchKind`/`Preset` types, `Backoff.StableResetMs`, `DriftOutcomeKind`, `PER_PANE_SUBSCRIPTION_TYPES` / `GLOBAL_SUBSCRIPTION_TYPES` (checked against the generated union by `test/types/contract/subscription-lists.ts`), error names and texts | (values; nothing to implement) | all |
| `src/not-implemented.ts` | `NotImplementedError`, `notImplemented(what, lane)` | architect | every stub |
| `src/wire/errors.ts` | `HerdrError`, `HerdrTransportError` (`isTimeout`), `ProtocolMismatchError`, `UnsupportedByServerError`, `SubscriptionEnded` (classes, built) | built (2a + contract step) | all |
| `src/wire/typed.ts` | `ParamsOf<M>`, `ResultOf<M>` | built (2a) | all |
| `src/wire/types.ts` | `CallEvent`, `OnCall`, `RpcOptions`, `Rpc`, `UnknownFrame`, `DecodedFrame`, `DecodePush`, `DedicatedConnection`, `DedicatedEnd`, `DedicatedOptions`, `OpenDedicated` | P2a (`rpc`, `call-hook`), P4a (`push-decoder.ts`, `dedicated.ts`) | P2b, P4a, P4b, P6a |
| `src/client/types.ts` | `ConnectOptions` (+`onUnknown`, order rule), `ClientCapabilities`, `ServerInfo`, `ClientBase` (`serverInfo`; `close()` ends every stream of the client), `ClientTransport` (resolved `socketPath`, `timeoutMs`, `onCall`, `onUnknown`, `closed` signal), `Caller<M>`, `Streaming`, `Holding`, `WithSubscribe<N>`, `EntryName`, `EntryMethod<E>`, `CoreClient` (+`transport`), `Client`, `AdminClient`, `ReadOnlyClient`, `ReadOnlyContentClient`, `PromptClient`, `SessionsReaderClient`, `ReadOnlyOptions`, `PresetOptions`, `ConnectCore`, `Connect`, `ConnectAdmin`, `ConnectPrompt`, `ConnectReadOnly` (overloads), `Invoke`, `NamespaceTree`, `BuildNamespaceTree`, `AllowedMethods` (takes the entry's base list, 2026-11-02), `StreamMembers` (the lazy stream members, 2026-11-02) | P2a (`ConnectCore`), P2b (the rest) | P4b, P5a tests, P6a, P6c, consumers |
| `src/client/subscribe/types.ts` | `QueueOptions`, `SubscribeOptions`, `EventSubscription`, `Subscribe`, `SubscribeDeps` (+`signal`: client close), `CreateSubscribe` | P4a | P2b (composes), P4b, P6a |
| `src/client/long-poll/types.ts` | `LongPollMethod`, `RequestTimeoutMs`, `AssertLongPollBounds` | P4a | P2b (`Invoke` calls them for `LONG_POLL` keys only), P6c |
| `src/client/watch/types.ts` | `WatchChange<S>`, `BackoffPolicy`, `Sleep`, `WatchOptions<S>`, `Watch<S>`, `WatchFn`, `CreateWatch`, `PerPaneSubscription(Type)`, `PaneSetChange`, `PaneSetSource`, `WatchPaneSetOptions`, `PaneSetWatch`, `WatchPaneSet` | P4b | P2b (composes), P6a |
| `src/client/held/types.ts` | `HeldConnection` (= `HeldNamespaces` + `ended`, `close`, `Symbol.asyncDispose`), `HoldOptions`, `Hold`, `HoldDeps` (+`buildTree`, `allowedMethods`, `signal`), `CreateHold` | P4b | P2b (composes), P6a |
| `src/test-kit/types.ts` | `FakeHerdrOptions`, `FakeHerdr` (2a minimum + 5a full: `replySequence`, `requests`, `push`, `closeSubscribers`, `subscriberCount`, `holdPushes`, `splitAck`, `strayLine`, `heldCount`, `closeHeld`, `capabilities`, option `version`, `reproduces: WireFact[]`), `ReceivedRequest`, `FakeStep<M>`, `UnknownPush`, `CreateFakeHerdr` | P2a (minimum, built), P5a (full) | every lane's tests after integration |
| `src/drift/types.ts` | `SchemaDocument`, `SchemaInventory`, `NameDiff`, `DriftReport`, `InventoryOf`, `DriftBetween`, `SchemaRead`, `SchemaSource`, `DriftOutcome` (discriminated by `kind: DriftOutcomeKind`), `ExitCodeFor` | P5c | `bin/herdr-drift.ts` (P5c) |
| `src/effect/types.ts` | `HerdrLayerOptions` (+`onUnknown`, `env`), the four tagged-error shapes (each with `message`), `HerdrTaggedError`, `ToTaggedError`; services (base members), Layers, Streams (`EffectWatchOptions`), the `PaneSetSource` bridge and `watchPaneSet` in prose until amendment A1 | P6a | P6c, hub (6b) |
| `src/mcp/types.ts` | `ReadOnlyToolMethod`, `ReadOnlyToolkitOptions`, `ToolNameOf`, `BearerGuard`, `TokenFileOptions`, `TokenFileHandle`, `TokenFile`; `readOnlyToolkit` and `toolResult` in prose until amendment A1 | P6c | hub (6b) |
| entries `src/{index,read-only,admin,effect,mcp,drift,test-kit}.ts` | the public surface per subpath (they re-export the stubs today) | integration step | consumers, contract tests |

Contract tests (`test/types/contract/*.ts`, compiled by `tsc -p test/types`, never run): the README snippets of sections 1, 2, 3 and 5 compile, plus `toolNameOf` and `bearerGuard` of section 6 (sections 4 and 6's Effect members cannot compile before `effect` is pinned; A1 adds them); a read-only client has no write method, no `call()`, no `hold()`, no content without `{ content: true }`; `connect()` has no D, S, X methods and no class C methods; `call()` is limited to the entry's methods; a long-poll call without `timeout_ms` does not compile; `fake.reply` is typed per method; a write method cannot become an MCP tool; `PER_PANE_SUBSCRIPTION_TYPES` equals the generated per-pane union.

## Lane ownership

Paths are relative to `packages/herdr`. A lane may create or edit **only** its paths. "except `types.ts`" means the contract file in that folder stays read-only.

| Lane | May create / edit | Inputs (contracts) | Acceptance (plan section 10) | Tests against stubs of other layers |
|---|---|---|---|---|
| **P2a** Wire + rpc + fake (review fixes of 197f5f9) | `src/wire/{connection,line-splitter,envelope,id,rpc,call-hook,socket-path,protocol-policy}.ts`; `src/client/{connect-core,capability-gate}.ts`; `src/test-kit/fake-*.ts` (until P2a merges, then they pass to P5a); `test/wire/**`, `test/connect/**`, `test/support/**`; `tsconfig.dist-test.json` | `wire/types.ts`, `wire/errors.ts`, `client/types.ts` (`ConnectCore`, `CoreClient`), `test-kit/types.ts` | `bun test test/wire test/connect` (connection reuse fails, `id:""` rejects without hanging, no `child_process`); `bun run test:node` | none needed: wire is the bottom layer; the fake is its own |
| **P2b** Namespaces + scoped clients. Slice **P2b-1** first: `scoped/namespace-tree.ts` and `scoped/allowed-methods.ts` with their tests (P4b's held tests need them) | `src/client/connect.ts`; `src/client/scoped/**`; `examples/{script,read-only}.ts`, `examples/_stubs.ts`; `scripts/check-size.ts`; `test/scoped/**`; `test/types/scoped/**` | `client/types.ts`, `subscribe/types.ts`, `watch/types.ts`, `held/types.ts`, `long-poll/types.ts` | `bun test test/scoped`; `tsc -p test/types`; `bun scripts/check-size.ts`. Pass `core.transport` (never re-resolve the socket or timeout) and `transport.closed` as `signal` to `SubscribeDeps`/`HoldDeps`; pass `buildNamespaceTree` and `allowedMethods` to `HoldDeps` | compose with `createSubscribe`/`createWatch`/`createHold` stubs (calling them throws `NotImplementedError`, so tests assert presence, not behaviour); `Invoke` calls `requestTimeoutMs` only for `LONG_POLL` keys, so non-long-poll tests pass before P4a; runtime allow-list asserted with `fake.receivedMethods()` |
| **P3** Result map | `gen/method-result-map.ts`, `gen/**` (emitters it needs), `src/generated/**` (regenerated only), `docs/api/*.md`, `test/coverage.test.ts`, `test/gen/**` | `wire/typed.ts` (`ResultOf` must keep its shape) | `bun test test/coverage.test.ts`; `bun gen/index.ts && git diff --exit-code` | none: pure generator; it must not change any generated **name** a contract imports (`*Namespaces`, `METHODS`, `LONG_POLL`, `ENTRY_METHODS`, `PRESET_METHODS`, `PushFrame`, `Subscription`) |
| **P4a** Subscribe + long-poll | `src/wire/{push-decoder,dedicated}.ts` (on P2a's frozen exports only, see below); `src/client/subscribe/**` and `src/client/long-poll/**` except `types.ts`; `test/subscribe/**`, `test/long-poll/**`, `test/types/long-poll/**` | `wire/types.ts`, `subscribe/types.ts`, `long-poll/types.ts` | `bun test test/subscribe test/long-poll` (unknown kind → `UnknownFrame`, client `onUnknown` then per-call; client close ends the subscription); `tsc -p test/types` | a test-local `node:net` server under `test/subscribe/support/` until P5a's `push`/`splitAck`/`strayLine` land; an in-memory `OpenDedicated` stub for `createSubscribe` unit tests |
| **P4b** Watch + held | `src/client/watch/**` and `src/client/held/**` except `types.ts`; `test/watch/**`, `test/held/**` | `watch/types.ts`, `held/types.ts`, `subscribe/types.ts`, `wire/types.ts`, `client/types.ts` (`BuildNamespaceTree`, `AllowedMethods`, `Invoke`) | `bun test test/watch test/held` (snapshot removal fails the suite, `watchPaneSet` follows created/closed, frames between ack and snapshot, overflow, held stays open then closes, client close ends watch and held) | an in-memory `Subscribe` (scripted `EventSubscription`), an injected `Sleep`, an in-memory `OpenDedicated`; a `PaneSetSource` object literal; held leaves are built through the injected `HoldDeps.buildTree` with the same `Invoke` type as every client (no second tree builder). Unit tests inject a tiny builder; the test that uses the real `buildNamespaceTree` + `allowedMethods('held')` waits for slice P2b-1. Subscription defaults come from `GLOBAL_SUBSCRIPTION_TYPES` / `PER_PANE_SUBSCRIPTION_TYPES`, never a hand list |
| **P5a** Full fake | `src/test-kit/**` except `types.ts` (after P2a merges); `test/test-kit/**` | `test-kit/types.ts`, `wire/types.ts` | `bun test test/test-kit` x3 | drives the fake with `rpc` and raw sockets (`test/support/raw-socket.ts`, read-only for P5a); W1-W6 each one test; `reproduces` lists exactly the facts tested |
| **P5c** Drift | `src/drift/**` except `types.ts`; `bin/herdr-drift.ts`; `test/drift.test.ts`, `test/drift/**` | `drift/types.ts` | `bun test test/drift.test.ts` (no herdr on PATH → 3) | injected `SchemaSource` fakes; never runs the real `herdr` (`PATH` set to an empty dir in the test) |
| **P6a** `/effect` (starts after amendment A1, not before 2026-11-16) | `src/effect/**` except `types.ts`; `test/effect/**` | `effect/types.ts` (after A1), `client/types.ts`, all client stream types | `bun test test/effect`; hub tests green against `bun link`. Replaces the A1 stubs in `src/effect/services.ts` | the core via `createFakeHerdr`; `toTaggedError` table test per error class |
| **P6c** `/mcp` (after A1 and S7 merged) | `src/mcp/**` except `types.ts`; `test/mcp/**` | `mcp/types.ts` (after A1), `effect/types.ts`, the `HerdrReadOnly` tag from A1's `src/effect/services.ts` stub (the mcp layer may import effect: `rules/layers.ts`) | `bun test test/mcp`; no-leak test | its own test layer: `Layer.succeed(HerdrReadOnly, ...)` over an in-memory service; never P6a's real layer until integration |
| **6b** Hub migration (S8) | hub repo paths of plan section 9 only | the integrated package | plan section 10 row 6b | n/a (runs after all lanes are integrated) |

### Shared files (integration step only)

No lane edits these. The integration step (architect, after each lane's review) does:

- `package.json` (exports, scripts, dependencies, `effect` pin in A1), `bun.lock`;
- the entries `src/index.ts`, `src/read-only.ts`, `src/admin.ts`, `src/effect.ts`, `src/mcp.ts`, `src/drift.ts`, `src/test-kit.ts`;
- `README.md`, `CHANGELOG.md`, `docs/architecture/plan.md`, this file, the ADRs, `c4/`;
- `rules/layers.ts`, `scripts/check-layers.ts`, `tsconfig.json`, `test/types/tsconfig.json`, `test/types/contract/**`.

`src/constants.ts` is the one exception: a lane appends constants **only between its own `// --- lane Px ---` and `// --- end Px ---` lines** at the end of the file (blank lines separate the sections so two lanes' inserts are separate merge hunks). It never edits lines outside that section. The integration step resolves the (append-only) merge.

### Lane graph

```
now:   P2a(review fixes) ─┬─────────────────────────────► P5a (takes over src/test-kit fake files)
       P2b (slice P2b-1 first) ┤
       P3  ───────────────┤
       P4a ───────────────┤   (P4b builds on stubs of P4a; its real-tree held test waits for P2b-1)
       P4b ───────────────┤
       P5c ───────────────┘
2026-11-06: integration item A0 (@types/bun pinned; tsconfig.test.json covers every test dir)
2026-11-16: amendment A1 (effect pinned; Effect/MCP types; effect/services.ts stubs) ─► P6a ─┐
                                               S7 merged + A1 ─► P6c ─┼─► integration ─► 6b hub migration (S8)
           (P6a and P6c run in parallel: P6c needs only A1's tags, not P6a's code)
```

### Frozen seams that are not contract files

Other lanes read these, so their **exported signatures are frozen** for the owning lane (bodies may change; a signature change is a contract amendment):

- P2a, used by P4a's `dedicated.ts`: `wire/connection.ts` (`Connection`, `ConnectionHandlers`), `wire/line-splitter.ts` (`LineSplitter`), `wire/envelope.ts` (`encodeRequest`, `isErrorEnvelope`, `isObject`, the envelope types), `wire/id.ts` (`nextId`).
- P2a, used by every lane's tests: `test/support/{fake,wait,rejection,raw-socket}.ts` (`withFake`, `waitUntil`, `rejectionOf`, `openRawSocket`, `RawSocket`). A lane that needs another helper writes it under its own test dir (`test/<lane dir>/support/`), never in `test/support/`.
- P2b slice P2b-1, used by P4b: `buildNamespaceTree`, `allowedMethods` (their contract types are in `client/types.ts`).

### Test fixtures and P3

P3 makes `ResultOf` precise. A fixture written today must stay valid then: use full results of mapped methods, or a typed builder kept in the lane's own `test/<lane>/support/`; a partial fixture is cast once, in that builder, with a comment (as `test/connect` does). P3's acceptance includes `bun run typecheck` (which covers `tsconfig.test.json`) and, from A0, every test dir.

### Integration items

- **Now (this amendment, done):** `rules/layers.ts` lets `mcp` import `effect` (P6c needs `HerdrReadOnly` and `HerdrTaggedError`); `tsconfig.test.json` type-checks `bin`, `examples` and the `node:test` dirs as part of `bun run typecheck`; `src/index.ts` exports the types of every function it exports (`Subscribe`, `Hold`, `WatchFn`, `Sleep`, `PaneSetSource`, `PaneSetWatch`, `WatchPaneSetOptions`).
- **A0 (2026-11-06):** pin `@types/bun` 1.4.4 (`npm view @types/bun time` first); widen `tsconfig.test.json` to `bin`, `examples`, `test` minus `test/gen/fixtures`, `test/scripts/fixtures`, `test/types`.
- **A1 (2026-11-16):** pin `effect`; type the prose of `effect/types.ts` and `mcp/types.ts`; create `src/effect/services.ts` (four tags declared, four layers as stubs that throw for Lane.P6a); add the README section 4 and 6 snippets to `test/types/contract/`; check `tokenFile`/`bearerGuard` against S7.

## Notes for the P2a lane (review of 197f5f9)

Kept as built: wire files, errors, envelope, rpc (now annotated `: Rpc`), socket path, protocol policy, the minimal fake. Changed by the contract step:

- `client/connect.ts` → `client/connect-core.ts`, `connect` → `connectCore` (`ConnectCore`, returns `CoreClient`); the public `connect()` is P2b's composition. `test/connect` imports `connectCore`.
- `client.server` → `client.serverInfo` (`server` is herdr's `server.*` namespace).
- `CallOptions` is the generated one (`signal`, `timeoutMs`): **P2a must honour `timeoutMs` in `call()`** (today only `signal` is passed).
- `CallEvent`, `OnCall`, `RpcOptions` moved into `wire/types.ts`; `call-hook.ts` and `rpc.ts` re-export them.
- `fake-types.ts` → `test-kit/types.ts` (full contract). `fake.reply` is typed per method, so partial fixtures in `test/wire/rpc.test.ts` and `test/connect/connect.test.ts` are cast with a comment. The 5a members are stubs in `fake-herdr.ts`; `reproduces` lists W1, W3.
- **Contract review (this amendment):** `CoreClient.transport` (resolved `socketPath`, `timeoutMs`, `onCall`, `onUnknown`, `closed`) and `close()` aborting `transport.closed` are now in `connect-core.ts` with a test; the fake takes a `version` option (pong `version`); `heldCount`/`closeHeld` are P5a stubs. P2a keeps them and must not change the frozen exports listed above.
- Open for P2a's review: `connection.ts` `close()` is a half-close but rpc always destroys; check `Connection.open` handles a socket `close` before `connect`.

## Open issues

1. **W1 vs class C.** The fake keeps a class C connection open (`heldCount`, `closeHeld`, P5a) so `hold()` has a fake-based test; the real behaviour still needs phase 5b.
    herdr closes after every response (W1, measured on 0.9.0), yet class C methods last "until this API connection closes". `HeldConnection` assumes herdr keeps a connection open after a class C reply. Not measured: phase 5b must record a golden, or `hold()` is OPEN. If herdr closes anyway, `ended` resolves and the contract still holds.
2. **Effect and MCP types are prose until A1.** `effect` 4.1.2 is 14 days old on 2026-11-16 (HERDR-ADR-0015). A1 adds the pin, then turns the prose blocks in `effect/types.ts` and `mcp/types.ts` into types. P6a and P6c start after A1.
3. **`tokenFile` / `bearerGuard` shapes** are taken from plan section 7 and the hub's S7 description. S7 has not merged. A1 checks them against S7's `mcp-token-file.ts` and `mcp-http.ts`.
4. **`connectPrompt` lives in `/read-only`** (README section 3). If the hub voice path should import it from `.`, that is an integration-step re-export, not a contract change.
5. **The generated `events.subscribe` leaf** is `Promise<unknown>` with object params. The contract replaces it with `WithSubscribe` (an array of specs, matching the README). A later generator change may emit it directly, but only with the same public shape.
6. **No README snippet for `/effect` compiles yet** (no `effect` installed). The contract test for the Effect entry covers only `toTaggedError` and the error shapes; A1 adds sections 4 and 6.
8. **`pane.output_matched` needs `match` and `source`**, not only `pane_id`. `watchPaneSet`'s default `types` (all three) cannot build that spec without them. P4b reports how it handles it; the likely amendment is default `[PaneAgentStatusChanged, PaneScrollChanged]` plus an `outputMatch` option.
7. `src/not-implemented.ts` is registered as a constants-layer file in `rules/layers.ts`. Phase 8 deletes it once no stub is left.
9. **`watchPaneSet` cannot yet replace the hub fleet (hub S8, 2026-11-02).** The hub needs (a) a first-Live marker (`FleetChange.Live` gates the link as connected), (b) silent adoption of the initial pane set (ADR-0010), and (c) the full pane rows at first sight (cwd and agent, ADR-0006), since `Added` carries only a pane id. Proposed: a `snapshot` option returning the full pane rows plus a first-Live marker. Until then the hub keeps its generation loop over `events.subscribe` and `session.snapshot`.
10. **`SubscriptionEventKind` is not exported from `.`** (`/read-only` neither). The hub compares a `pane.agent_status_changed` frame with `SubscriptionType.PaneAgentStatusChanged`, which has the same value. Export the kind from `.` to make the comparison exact.

## Contract review log (2026-11-02)

| Finding | Disposition |
|---|---|
| P4b held needs P2b's tree builder | fixed: `HoldDeps.buildTree` + `allowedMethods` injected; slice P2b-1 lands them first; P4b unit tests inject a tiny builder |
| `mcp` may not import `effect` | fixed: `rules/layers.ts` |
| P6c needs runtime tags | fixed (doc): A1 creates `src/effect/services.ts` stubs; P6c uses its own test layer; graph updated |
| tagged errors lack `message` | fixed: `message` on all four shapes; README table has `isTimeout` |
| P6a prose underspecified | fixed: `EffectWatchOptions`, base members, PaneSetSource bridge in prose; `onUnknown`, `env` typed on `HerdrLayerOptions` |
| `close()` vs streams | fixed: `close()` aborts `ClientTransport.closed`; `SubscribeDeps.signal`, `HoldDeps.signal` |
| P2b re-resolves socket/timeout | fixed: `CoreClient.transport`, implemented in `connect-core.ts` |
| P2a wire internals used by P4a | fixed: frozen exports listed above |
| tests and bin/examples not type-checked | fixed in part: `tsconfig.test.json` in `typecheck` now; `bun:test` dirs join at A0 (2026-11-06), when `@types/bun` may be pinned (HERDR-ADR-0015) |
| adjacent lane markers in `constants.ts` | fixed: `--- end Px ---` sentinels and blank lines |
| hand lists of global / per-pane types | fixed: lists in the constants contract section, checked both ways against the generated union by a contract test |
| FakeHerdr gaps | fixed: `push` filtering documented, `heldCount`/`closeHeld` (P5a stubs), `version` option (built), ack-timeout recipe |
| `WatchPaneSetOptions` lacks `queue`/`onUnknown` | fixed |
| P3 breaks partial fixtures | fixed (doc): fixture rule above; P3 runs the widened typecheck |
| `test/support` shared | fixed (doc): frozen exports; other helpers stay in the lane's dir |
| contract-test sentence and `bun run generate` | fixed |
| `DriftOutcome` discriminated by key | fixed: `DriftOutcomeKind` |
| `onUnknown` declared four times | fixed: client hook first, then per-call; only subscribe calls them; watch forwards its own |
| `.` exports functions without their types | fixed for the listed types. Rejected for `ReadOnlyClient` / `AdminClient`: they stay on `/read-only` and `/admin` with their connect functions (HERDR-ADR-0005: a scope is chosen by the entry you import) |

## Build amendment (2026-11-02, low-footprint build)

The owner's requirement: the library is compiled, and a consumer's bundle carries only what it uses. The public API, names and result types are unchanged; what changed is how the code is split and shipped (HERDR-ADR-0015, plan 10.1). Status of the rows above: P2b-1 (`buildNamespaceTree`, `allowedMethods`) and P2b are landed; P4b's real-tree held test runs (it no longer skips).

- **Signatures that changed (contract types in `client/types.ts`):** `AllowedMethods(base, { methods? })` takes the entry's base list; `StreamMembers` is the lazy member set; `composeClient` and `composeOrClose` take an optional fourth argument `streams` (default `lazyStreams(core)`).
- **Generated layout (`src/generated/`):** `names/` (one module per kind; `method.ts` holds one `MethodX` constant per method and the `Method` object); `method-table.ts` (`METHODS`, `MethodName`; not imported by the library); `entries/*.ts` (one list per entry: `CLIENT_METHODS`, `ADMIN_METHODS`, `READ_ONLY_METHODS`, and so on); `presets/*.ts`; `entry-methods.ts` (`ENTRY_METHODS`); `preset-methods.ts` (`PRESET_METHODS`); `test-data/` (`DEFAULT_RESULT`, `PARAMS_SHAPE`; test-kit only). `generated/index.ts` re-exports the same names as before.
- **Library code imports `MethodX` constants**, not the `Method` object, in `src/client`, `src/wire` and `src/effect` (`scripts/check-layers.ts`, rules `method-value-use` and `method-value-import`; `import type { Method }` is allowed).
- **Lazy boundary:** `client/scoped/lazy-streams.ts` loads `client/scoped/streams.ts` (subscribe, watch, hold) through `import()` on first use. `compose.ts` still refuses a watch without `events.subscribe` or `session.snapshot` synchronously, before anything loads.
- **No-leak rule (`scripts/check-size.ts`):** no production row or scenario may contain test-kit, `generated/test-data/`, `generated/drift/`, `generated/method-table`, `generated/entry-methods`, or `child_process`. `/read-only` and the read-only scenarios also refuse `/admin.js`, `connect-admin` and `/effect` (HERDR-ADR-0005).
- **Tests:** `test/scoped/lazy-streams.test.ts` checks the eager and the lazy stream members over the fake; `test/types/contract/connect-result-types.ts` checks the result type of each connect function.
- **Not done:** the `constants/` split (plan 10.1 step 4) is deferred (HERDR-ADR-0015).

## Open library slices from the hub's S8 review (2026-11-02)

- **LIB-S8-1 (footprint, open, blocks the hub's footprint claim).** The hub's herdr-only entry is 38,178 B unsplit (15,442 B with the vendored client). The hub already imports the narrowest names (`.`, 3,683 B) and connect (`/read-only`, `connectReadOnly` + `Presets`, 25,318 B). The ~22 KB is the connect composition: `client/scoped/compose.ts` builds every namespace and reaches held, long-poll and watch. Target: a preset-only connect that builds only the members its preset needs (SessionsReader: session, agent.list/get, pane.get/list; fleet: session.snapshot and events.subscribe), and a smaller name table. Done when the herdr-only row of the hub's STATUS.md is no larger than 15,442 B unsplit, or the owner waives it in writing.
- **LIB-S8-2 (packaging, open).** `dist/generated/test-data/*.js` ships in the tarball and the production entry re-exports it (`generated/index.js`). Target: the entry stops re-exporting the test data, so the hub image can drop it like `dist/test-kit*` (the Containerfile already prunes the test kit).
