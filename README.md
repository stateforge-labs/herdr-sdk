# @homelab/herdr

A typed client for the whole [herdr](https://herdr.dev) socket API (protocol 22, herdr 0.9.5: 102 methods, 26 event kinds, 27 subscription types), for Bun and Node.

> **Status: lanes P2a to P6c integrated on feat/herdr-lib (interfaces locked, HERDR-ADR-0017). `/effect` and `/mcp` expose only the effect-free contract until amendment A1 (effect pin); the full fake (P5a) and executable README snippets are not yet done. Treat the API below as the target.** This README is written first so the code is shaped by how it is used. When the code lands, every snippet comes from `examples/*.ts` (checked by `scripts/check-readme.ts`), compiles in CI, and the ones marked "runs" execute against the fake herdr ([HERDR-ADR-0014](docs/decisions/HERDR-ADR-0014-executable-docs.md)). Plan: [docs/architecture/plan.md](docs/architecture/plan.md) · decisions: [docs/decisions/](docs/decisions/README.md).

## Entry points

| Import | What | Runtime deps |
|---|---|---|
| `@homelab/herdr` | `connect()`: reads, writes, input, hooks, long-poll, `hold()`; errors; generated types and constants | none |
| `@homelab/herdr/read-only` | `connectReadOnly()`: structure reads only; terminal content on opt-in | none |
| `@homelab/herdr/admin` | `connectAdmin()`: adds destructive, server-control and spawn/execute methods | none |
| `@homelab/herdr/effect` | `Herdr` service, Layers, tagged errors, Streams | peer `effect` 4.1.2 |
| `@homelab/herdr/test-kit` | `createFakeHerdr()` (tests only) | none |
| `@homelab/herdr/mcp` | read-only MCP toolkit (Effect AI) | peer `effect` 4.1.2 |
| `herdr-drift` (bin) | compare the committed schema with the installed herdr | none |

`@homelab/herdr/model` (domain entities) arrives later, with atalaya as its first user.

Wire types are `export type` only. Raw strings are accepted by the types, but these docs always use the generated constants (`Method`, `EventKind`, `SubscriptionType`, `AgentStatus`, `WatchKind`).

## 1. A small script (Promise API)

```ts
import { connect, HerdrError } from "@homelab/herdr"

const herdr = await connect() // finds the socket (HERDR_SOCKET, else ~/.config/herdr/herdr.sock), pings, checks protocol 22

const { agents } = await herdr.agent.list({})
for (const agent of agents) console.log(agent.name, agent.agent_status)

try {
  await herdr.agent.prompt({ target: "reviewer", text: "run the tests" })
} catch (error) {
  if (error instanceof HerdrError) console.error(error.code, error.message)
  else throw error
}

herdr.close()
```

Methods are nested by their dotted name: `herdr.pane.list({})`, `herdr.agent.view.set({...})`. `connect()` has no destructive or server-control methods (`*.close`, `server.stop`, `plugin.link`...); those need `connectAdmin()` from `@homelab/herdr/admin`.

A protocol mismatch fails fast; a method the server does not support fails before sending:

```ts
import { connect, ProtocolMismatchError } from "@homelab/herdr"

try {
  await connect()
} catch (error) {
  if (error instanceof ProtocolMismatchError) console.error(`herdr speaks ${error.actual}, this library ${error.expected}`)
}
```

## 2. Subscriptions, long-poll and held connections (atalaya on Node)

```ts
import { connect, SubscriptionType, EventKind, AgentStatus, WatchKind } from "@homelab/herdr"

const herdr = await connect({ onCall: ({ method, durationMs, outcome }) => metrics.record(method, durationMs, outcome) })

const subscription = await herdr.events.subscribe([
  { type: SubscriptionType.PaneCreated },
  { type: SubscriptionType.PaneClosed },
  { type: SubscriptionType.PaneAgentStatusChanged, pane_id: "p_1" },
])
for await (const frame of subscription) {
  if (frame.event === EventKind.PaneClosed) break
}
subscription.close()

// Long-poll: the timeout is required (herdr would wait forever).
const done = await herdr.agent.wait({ target: "reviewer", until: [AgentStatus.Done], timeout_ms: 60_000 })

// watch: subscribe, snapshot, replay frames that arrived meanwhile, resubscribe with backoff (1 s doubling to 30 s).
for await (const change of herdr.watch({ snapshot: () => herdr.session.snapshot({}) })) {
  if (change.kind === WatchKind.Live) render(change.snapshot)
  else apply(change.frame)
}

// Connection-bound methods run on a held connection; closing it ends the title, lease or registration.
await using held = await herdr.hold()
await held.client.window_title.set({ title: "review" })
```

A timeout is not proof that a prompt was not delivered: never resend blindly.

## 3. Read-only and prompt-only clients

```ts
import { connectReadOnly, Presets } from "@homelab/herdr/read-only"

const herdr = await connectReadOnly({ preset: Presets.SessionsReader }) // session.snapshot, agent.list, agent.get, pane.get, pane.list
const snapshot = await herdr.session.snapshot({})
// @ts-expect-error a read-only client has no write methods and no generic call()
await herdr.agent.prompt({ target: "x", text: "y" })
```

Without options it allows structure reads and long-poll; terminal content (`pane.read`, `agent.read`) needs `{ content: true }`. `{ methods: [Method.AgentList, ...] }` narrows at runtime. `connectPrompt()` adds exactly `agent.prompt`.

## 4. The hub (Effect)

```ts
import { Effect, Stream } from "effect"
import { Herdr, HerdrReadOnly, watchPaneSet } from "@homelab/herdr/effect"

const program = Effect.gen(function* () {
  const herdr = yield* Herdr
  return yield* herdr.session.snapshot({})
})

const fleet = Stream.unwrap(Effect.map(HerdrReadOnly, (herdr) => watchPaneSet(herdr)))

const HerdrLive = Herdr.layer({ timeoutMs: 5_000 }) // no default timeout: the composition root decides
```

| Promise error | Effect `_tag` | Fields |
|---|---|---|
| `HerdrError` | `HerdrRefused` | `method`, `code`, `message` |
| `HerdrTransportError`, `SubscriptionEnded` | `HerdrUnavailable` | `cause`, `isTimeout` |
| `ProtocolMismatchError` | `ProtocolMismatch` | `expected`, `actual` |
| `UnsupportedByServerError` | `HerdrUnsupported` | `method`, `capability` |

Every tagged error also has `message` (the Promise error's message).

Layers: `Herdr.layer`, `Herdr.layerReadOnly`, `Herdr.layerPrompt`, `Herdr.layerAdmin`.

## 5. Tests (no live herdr) — runs

```ts
import { test, expect } from "bun:test"
import { connect, Method, ResultTag } from "@homelab/herdr"
import { createFakeHerdr } from "@homelab/herdr/test-kit"

test("lists agents", async () => {
  const fake = await createFakeHerdr()
  fake.reply(Method.AgentList, { type: ResultTag.AgentList, agents: [] })
  const herdr = await connect({ socketPath: fake.path })

  await herdr.agent.list({})

  expect(fake.receivedMethods()).toEqual([Method.Ping, Method.AgentList])
  herdr.close()
  await fake.stop()
})
```

The fake runs on `node:net`, answers every method with a schema-valid default, rejects malformed params with an error envelope, and supports `fail`, `silent`, `replySequence`, `push(frame)`, `closeSubscribers()`, `subscriberCount()`, `connectionCount()` and `capabilities`. A real herdr is used only by `bun run test:contract`, with the owner's OK.

## 6. MCP add-on

```ts
import { Method } from "@homelab/herdr"
import { readOnlyToolkit } from "@homelab/herdr/mcp"

const tools = readOnlyToolkit({ methods: [Method.SessionSnapshot, Method.AgentList] }) // herdr_session_snapshot, herdr_agent_list; readOnlyHint
```

It never registers a write method.

## Drift

```sh
bun run capture      # herdr api schema --json > schema/herdr-api.schema.json
bun run gen          # regenerate src/generated and docs/api
herdr-drift          # exit 0 clean, 1 drift, 2 usage, 3 herdr not found
```

## Using it from your own domain

The library conforms to herdr's wire vocabulary. Keep your own domain language behind your own port, and let one adapter file import `@homelab/herdr`. The dependency-cruiser rule template enforces that (`rules/`; idea from atalaya-bridge, spine AD-10). Snapshot before you subscribe, because a subscription delivers changes, not the present. `watch()` does this for you ([HERDR-ADR-0016](docs/decisions/HERDR-ADR-0016-design-intent-inherited-from-atalaya.md)).

## Licence

MIT. Derived from brooswit/jsHerdrSDK (e34fd3f) via atalaya-bridge (097adfd); see `NOTICE.md`.
