# @homelab/herdr

A typed client for the whole [herdr](https://herdr.dev) socket API (protocol 22, herdr 0.9.5: 102 methods, 26 event kinds, 27 subscription types), for Bun and Node.

> **Status: 0.2.0, published to the homelab GitLab npm registry.** The Promise API, the three capability-scoped clients, the fake herdr (`/test-kit`), the schema and drift tools and the agent skill are built and tested against the fake herdr. The `/effect` entry exposes only the effect-free part (`toTaggedError`, the layer option and error types): the `Herdr` service and Layers wait for amendment A1 (the `effect` pin, due 2026-11-16). Every snippet marked "runs" is executed in CI; section 4 shows the planned Effect surface, not code you can import today.

## Entry points

| Import | What | Runtime deps |
|---|---|---|
| `@homelab/herdr` | `connect()`: reads, writes, input, hooks, long-poll, `hold()`; errors; generated types and constants | none |
| `@homelab/herdr/read-only` | `connectReadOnly()`: structure reads only; terminal content on opt-in | none |
| `@homelab/herdr/admin` | `connectAdmin()`: adds destructive, server-control and spawn/execute methods | none |
| `@homelab/herdr/effect` | `toTaggedError` and the Effect layer types now; the `Herdr` service, Layers and Streams after amendment A1 | none now (peer `effect` 4.1.2 after A1) |
| `@homelab/herdr/test-kit` | `createFakeHerdr()` (tests only) | none |
| `@homelab/herdr/schema` | method table and parameter shapes of the generated API (what a generator such as herdr-mcp builds its tools from) | none |
| `@homelab/herdr/core` | `CoreLink`, `CoreEvents`, the wire parsers and the socket path rule: a client of the herdr-core (`hc`) socket, standalone from the protocol-22 client (HERDR-ADR-0020) | none |
| `@homelab/herdr/core/test-kit` | `FakeHcCore`, `setupTest(t)`, `openWorld()` (tests only) | none |
| `@homelab/herdr/drift` | `driftBetween`, `inventoryOf`, `exitCodeFor`: the library behind `herdr-drift`, for your own tooling | none |
| `herdr-drift` (bin) | compare the committed schema with the installed herdr | none |
| `herdr-skill` (bin) | print or install the agent skill that ships in `skills/herdr-sdk` | none |

`@homelab/herdr/model` (domain entities) arrives later, with atalaya as its first user.

Wire types are `export type` only. Raw strings are accepted by the types, but these docs always use the generated constants (`Method`, `EventKind`, `SubscriptionType`, `AgentStatus`, `WatchKind`).

## Install

From the homelab GitLab registry ([HERDR-ADR-0019](docs/decisions/HERDR-ADR-0019-publish-to-the-gitlab-npm-registry-on-a-tag.md)). In the consumer's `bunfig.toml`:

```toml
[install.scopes]
"@homelab" = { url = "https://gitlab.example.internal/api/v4/projects/518/packages/npm/", token = "$HOMELAB_NPM_TOKEN" }
```

`HOMELAB_NPM_TOKEN` is a read-only token (`read_package_registry`). A release younger than 14 days needs an entry in `minimumReleaseAgeExcludes`. Releases are protected `v*` tags (Maintainers only); the pipeline checks the tag equals the `package.json` version.

## Footprint

The package ships compiled ESM in `dist/` with declarations (no bundle). A bundler or Node loads only the modules a call reaches: `connect()` does not load the streams until `events.subscribe`, `watch()` or `hold()` is first used.

Measured on 2026-11-02, minified (`bun run check:size`, which builds `dist/` and fails on a budget or a leak):

| What a consumer imports | Bytes |
|---|---|
| `@homelab/herdr` (every method, `connect()`) | 26,887 |
| `@homelab/herdr/read-only` | 18,691 |
| `@homelab/herdr/admin` | 15,561 |
| a read-only script that narrows to one method | 17,513 |
| the streams chunk (`events.subscribe`, `watch`, `hold`), loaded on first use | 7,672 |

The declarations use `AbortSignal` and `AsyncDisposable`. Consumers need `@types/node` 22 or later, or a `lib` that has them (`es2023`, `esnext.disposable`, and `DOM` or `@types/node`). `/test-kit` declarations also import `node:net`.

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

## 4. The hub (Effect): planned, not in 0.2.0

The error table below is built (`toTaggedError`). The service and layers in the snippet need amendment A1 and are not importable yet.

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

The fake runs on `node:net`, answers `ping` and every method you script with `reply`, answers an unscripted method with an `unknown_method` error envelope, and supports `fail`, `silent`, `replySequence`, `push(frame)`, `closeSubscribers()`, `subscriberCount()`, `connectionCount()` and `capabilities`. No test talks to a real herdr: contract tests against a live server are planned (HERDR-ADR-0008) and will need the owner's OK.

## Drift

```sh
bun run capture      # herdr api schema --json > schema/herdr-api.schema.json
bun run gen          # regenerate src/generated and docs/api
herdr-drift          # exit 0 clean, 1 drift, 2 usage, 3 herdr not found
```

## For coding agents (the skill)

The package ships an Agent Skill, `skills/herdr-sdk/` ([HERDR-ADR-0018](docs/decisions/HERDR-ADR-0018-the-skill-ships-in-the-package.md)): which entry point to pick, recipes, errors, version facts. Its code blocks are type-checked and run against the fake in `test/skill/`.

```sh
herdr-skill install              # copies it to .claude/skills/herdr-sdk (or: herdr-skill install ~/.claude/skills)
herdr-skill print                # prints SKILL.md, for agents that take a prompt rather than a folder
```

Claude Code does not look inside `node_modules`, so `install` copies the skill to a skills directory. For other agents, add this to the project's `AGENTS.md`:

> Code that uses `@homelab/herdr`: read `node_modules/@homelab/herdr/skills/herdr-sdk/SKILL.md` first.

## Using it from your own domain

The library conforms to herdr's wire vocabulary. Keep your own domain language behind your own port, and let one adapter file import `@homelab/herdr`. `scripts/check-layers.ts` enforces the library's own layers; the one-adapter rule for consumers is a convention (idea from atalaya-bridge, spine AD-10). Snapshot before you subscribe, because a subscription delivers changes, not the present. `watch()` does this for you ([HERDR-ADR-0016](docs/decisions/HERDR-ADR-0016-design-intent-inherited-from-atalaya.md)).

## Licence

MIT. Derived from brooswit/jsHerdrSDK (e34fd3f) via atalaya-bridge (097adfd); see `NOTICE.md`.
