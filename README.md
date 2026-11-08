# @stateforge-labs/herdr-sdk

A typed client for the whole [herdr](https://herdr.dev) socket API (protocol 22, herdr 0.9.5: 102 methods, 26 event kinds, 27 subscription types), for Bun and Node.

> **Version 0.3.0.** ESM only, Node 22.18+ and Bun. The Promise API, the herdr-core client (`/core`, `/core/test-kit`), the three capability-scoped clients, the fake herdr (`/test-kit`), the schema and drift tools, the tagged errors of `/effect` and the agent skill, all tested against the fake herdr. Every snippet marked "runs" is executed in CI.

## Entry points

| Import | What | Runtime deps |
|---|---|---|
| `@stateforge-labs/herdr-sdk` | `connect()`: reads, writes, input, hooks, long-poll, `hold()`; errors; generated types and constants | none |
| `@stateforge-labs/herdr-sdk/read-only` | `connectReadOnly()`: structure reads only; terminal content on opt-in | none |
| `@stateforge-labs/herdr-sdk/admin` | `connectAdmin()`: adds destructive, server-control and spawn/execute methods | none |
| `@stateforge-labs/herdr-sdk/effect` | `toTaggedError`, `EffectErrorTag` and the tagged error types, for mapping the Promise errors into an Effect program | none |
| `@stateforge-labs/herdr-sdk/test-kit` | `createFakeHerdr()` (tests only) | none |
| `@stateforge-labs/herdr-sdk/schema` | method table and parameter shapes of the generated API (what a generator, such as an MCP server, builds its tools from) | none |
| `@stateforge-labs/herdr-sdk/core` | `CoreLink`, `CoreEvents`, the wire parsers and the socket path rule: a client of the herdr-core (`hc`) socket, standalone from the protocol-22 client | none |
| `@stateforge-labs/herdr-sdk/core/test-kit` | `FakeHcCore`, `setupTest(t)`, `openWorld()` (tests only) | none |
| `@stateforge-labs/herdr-sdk/drift` | `driftBetween`, `inventoryOf`, `exitCodeFor`: the library behind `herdr-drift`, for your own tooling | none |
| `herdr-drift` (bin) | compare the committed schema with the installed herdr | none |
| `herdr-skill` (bin) | print or install the agent skill that ships in `skills/herdr-sdk` | none |

Wire types are `export type` only. Raw strings are accepted by the types, but these docs always use the generated constants (`Method`, `EventKind`, `SubscriptionType`, `AgentStatus`, `WatchKind`).

## Install

```sh
npm install @stateforge-labs/herdr-sdk
# or
bun add @stateforge-labs/herdr-sdk
```

Versions published from GitHub Actions with npm trusted publishing carry a provenance attestation
(`npm audit signatures` checks it); 0.3.0 was published by hand and has none. The release tag equals the `package.json` version.

## Footprint

The package ships compiled ESM in `dist/` with declarations (no bundle). A bundler or Node loads only the modules a call reaches: `connect()` does not load the streams until `events.subscribe`, `watch()` or `hold()` is first used.

Measured on 2026-11-02, minified (`bun run check:size`, which builds `dist/` and fails on a budget or a leak):

| What a consumer imports | Bytes |
|---|---|
| `@stateforge-labs/herdr-sdk` (every method, `connect()`) | 26,887 |
| `@stateforge-labs/herdr-sdk/read-only` | 18,691 |
| `@stateforge-labs/herdr-sdk/admin` | 15,561 |
| a read-only script that narrows to one method | 17,513 |
| the streams chunk (`events.subscribe`, `watch`, `hold`), loaded on first use | 7,672 |

The declarations use `AbortSignal` and `AsyncDisposable`. Consumers need `@types/node` 22 or later, or a `lib` that has them (`es2023`, `esnext.disposable`, and `DOM` or `@types/node`). `/test-kit` declarations also import `node:net`.

## 1. A small script (Promise API)

```ts
import { connect, HerdrError } from "@stateforge-labs/herdr-sdk"

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

Methods are nested by their dotted name: `herdr.pane.list({})`, `herdr.agent.view.set({...})`. `connect()` has no destructive or server-control methods (`*.close`, `server.stop`, `plugin.link`...); those need `connectAdmin()` from `@stateforge-labs/herdr-sdk/admin`.

A protocol mismatch fails fast; a method the server does not support fails before sending:

```ts
import { connect, ProtocolMismatchError } from "@stateforge-labs/herdr-sdk"

try {
  await connect()
} catch (error) {
  if (error instanceof ProtocolMismatchError) console.error(`herdr speaks ${error.actual}, this library ${error.expected}`)
}
```

## 2. Subscriptions, long-poll and held connections

```ts
import { connect, SubscriptionType, EventKind, AgentStatus, WatchKind } from "@stateforge-labs/herdr-sdk"

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
import { connectReadOnly, Presets } from "@stateforge-labs/herdr-sdk/read-only"

const herdr = await connectReadOnly({ preset: Presets.SessionsReader }) // session.snapshot, agent.list, agent.get, pane.get, pane.list
const snapshot = await herdr.session.snapshot({})
// @ts-expect-error a read-only client has no write methods and no generic call()
await herdr.agent.prompt({ target: "x", text: "y" })
```

Without options it allows structure reads and long-poll; terminal content (`pane.read`, `agent.read`) needs `{ content: true }`. `{ methods: [Method.AgentList, ...] }` narrows at runtime. `connectPrompt()` adds exactly `agent.prompt`.

## 4. Effect: tagged errors

`toTaggedError(error)` turns an error thrown by the Promise API into a plain object with an Effect-style `_tag`, so an Effect
program can fail with it (`Effect.tryPromise({ try, catch: toTaggedError })`). The package does not depend on `effect`.

| Promise error | Effect `_tag` | Fields |
|---|---|---|
| `HerdrError` | `HerdrRefused` | `method`, `code`, `message` |
| `HerdrTransportError`, `SubscriptionEnded` | `HerdrUnavailable` | `cause`, `isTimeout` |
| `ProtocolMismatchError` | `ProtocolMismatch` | `expected`, `actual` |
| `UnsupportedByServerError` | `HerdrUnsupported` | `method`, `capability` |

Every tagged error also has `message` (the Promise error's message).

## 5. Tests (no live herdr) — runs

```ts
import { test, expect } from "bun:test"
import { connect, Method, ResultTag } from "@stateforge-labs/herdr-sdk"
import { createFakeHerdr } from "@stateforge-labs/herdr-sdk/test-kit"

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

The fake runs on `node:net`, answers `ping` and every method you script with `reply`, answers an unscripted method with an `unknown_method` error envelope, and supports `fail`, `silent`, `replySequence`, `push(frame)`, `closeSubscribers()`, `subscriberCount()`, `connectionCount()` and `capabilities`. No test talks to a real herdr.

## Drift

`herdr-drift` ships as a bin. Refreshing the schema and regenerating the client happen in a clone of the repository:

```sh
bun run capture      # herdr api schema --json > schema/herdr-api.schema.json
bun run gen          # regenerate src/herdr/generated and docs/api
herdr-drift          # exit 0 clean, 1 drift, 2 usage, 3 herdr not found
```

## For coding agents (the skill)

The package ships an Agent Skill, `skills/herdr-sdk/` ([HERDR-ADR-0018](https://github.com/stateforge-labs/herdr-sdk/blob/main/docs/decisions/HERDR-ADR-0018-the-skill-ships-in-the-package.md)): which entry point to pick, recipes, errors, version facts. Its code blocks are type-checked and run against the fake in the repository's `test/skill/`.

```sh
herdr-skill install              # copies it to .claude/skills/herdr-sdk (or: herdr-skill install ~/.claude/skills)
herdr-skill print                # prints SKILL.md, for agents that take a prompt rather than a folder
```

Claude Code does not look inside `node_modules`, so `install` copies the skill to a skills directory. For other agents, add this to the project's `AGENTS.md`:

> Code that uses `@stateforge-labs/herdr-sdk`: read `node_modules/@stateforge-labs/herdr-sdk/skills/herdr-sdk/SKILL.md` first.

## Using it from your own domain

The library conforms to herdr's wire vocabulary. Keep your own domain language behind your own port, and let one adapter file import `@stateforge-labs/herdr-sdk`. `tools/scripts/check-layers.ts` enforces the library's own layers; the one-adapter rule for consumers is a convention. Snapshot before you subscribe, because a subscription delivers changes, not the present. `watch()` does this for you (see the [decision records](https://github.com/stateforge-labs/herdr-sdk/tree/main/docs/decisions)).

## Repository layout

This section describes the [GitHub repository](https://github.com/stateforge-labs/herdr-sdk); the npm package ships only `dist/`, the bins, the skill, the schema and the API docs.

One folder per product ([HERDR-ADR-0021](https://github.com/stateforge-labs/herdr-sdk/blob/main/docs/decisions/HERDR-ADR-0021-one-folder-per-product.md)); the entry files at the top of `src/` are the published subpaths.

| Folder | What it is |
| --- | --- |
| `src/herdr/` | The herdr server client (protocol 22): `errors.ts` (every error it throws), `wire/`, `client/` (one module per feature: `connect`, `scoped`, `subscribe`, `watch`, `watch-pane-set`, `held`, `long-poll`, and `streams`, loaded on first use), `generated/` (output of `tools/gen/`), `effect/`, `test-kit/` |
| `src/core/` | The herdr-core client (`./core`): `errors.ts` (every failure it returns), `kernel.ts` (its value types), `wire`, `link`, `events`, `backoff`, `constants`; its fake core in `test-kit/` (`./core/test-kit`) |
| `src/drift/` | The schema-drift tool behind `herdr-drift`: `schema`, `diff`, `cli`, `constants`, `types` |
| `test/` | Mirrors `src/` (`test/herdr/`, `test/core/`, `test/drift/`), plus `test/tools/`, `integration/` and `types/` |
| `tools/` | Build time only, never published: `gen/` (the generator), `scripts/` (gates, capture, build helpers), `rules/` (the layer rule) |
| `bin/`, `skills/`, `schema/`, `docs/` | The bins, the agent skill, the captured schema, the docs and decisions |

## Licence

MIT. Derived from [brooswit-factory/jsHerdrSDK](https://github.com/brooswit-factory/jsHerdrSDK) (e34fd3f) through an intermediate private port (097adfd); see `NOTICE.md`.
