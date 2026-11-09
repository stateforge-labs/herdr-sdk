---
name: herdr-sdk
description: Write TypeScript or JavaScript that talks to a running herdr server (spaces/workspaces, tabs, panes, coding agents) through the typed @stateforge-labs/herdr-sdk client over herdr's unix socket. Use when code imports @stateforge-labs/herdr-sdk, or the task is to list, watch, prompt, wait on or read herdr panes and agents from a script, plugin, daemon or test, or to fake herdr in tests, or to talk to herdr-core (hc) over its socket. Not for driving the herdr CLI by hand (hc skill) or the GUI window (herdr-app skill).
---

# @stateforge-labs/herdr-sdk

Typed client for herdr's socket API. Zero runtime dependencies, Bun and Node 22.18+. Targets **@stateforge-labs/herdr-sdk 0.3.1 = herdr protocol 22 (herdr 0.9.5)**.

## First: check the version

Do not trust memory of this API. Before writing code:

1. Read `node_modules/@stateforge-labs/herdr-sdk/package.json`: `version` and `herdr.protocol` must match the line above. If they differ, this skill may be stale; read the package's `docs/api/methods.md` and `docs/api/events.md` (generated from the schema, always current) before trusting any name here.
2. After editing, run the type checker. Param and result types are generated, so a wrong field name fails at compile time.

## Pick the entry point (least power that works)

| Import | Function | Can do | Cannot |
|---|---|---|---|
| `@stateforge-labs/herdr-sdk/read-only` | `connectReadOnly()` | structure reads (`*.list`, `*.get`, `session.snapshot`), long-poll waits, `events.subscribe`, `watch` | terminal content (opt in with `{ content: true }`), any write, generic `call()` |
| `@stateforge-labs/herdr-sdk/read-only` | `connectPrompt()` | structure reads + `agent.prompt` | everything else |
| `@stateforge-labs/herdr-sdk` | `connect()` | reads, content, UI changes, input, hooks, long-poll, `hold()` | destructive, server control, spawn/execute |
| `@stateforge-labs/herdr-sdk` | `connectPlugin()` | the `connect()` methods plus `plugin.pane.open`, `plugin.pane.focus`, `plugin.pane.close` (typed results), for plugin authors; see `docs/api/client.md` | destructive, server control, spawn/execute, `plugin.link/unlink/enable` |
| `@stateforge-labs/herdr-sdk` | `ErrorCode`, `SubscriptionEventKind`, `UnsupportedWatchError` | the agent error codes of a `HerdrError`, the per-pane event names, the `watchPaneSet` refusal; see `references/errors.md` and `docs/api/client.md` | |
| `@stateforge-labs/herdr-sdk/admin` | `connectAdmin()` | 98 of the 102 methods (the 4 connection-scoped ones are on `hold()`) | nothing |
| `@stateforge-labs/herdr-sdk/effect` | `toTaggedError()`, `EffectErrorTag`, `HerdrLayerOptions` and the tagged-error types | mapping herdr errors into Effect tagged errors | the Effect `Herdr` service and Layers (not shipped yet) |
| `@stateforge-labs/herdr-sdk/test-kit` | `createFakeHerdr()` | in-process fake server for tests | production use |
| `@stateforge-labs/herdr-sdk/schema` | method table, param shapes | tooling that reflects on the API | |
| `@stateforge-labs/herdr-sdk/core` | `CoreLink`, `CoreEvents`, `CoreRoster` (folds the feed into a table with added/changed/removed deltas), `CoreTerminals` (typed `terminal.list`, `terminal.get`, `terminal.read`), wire parsers, `hcCoreSocketPath()`, `HcTerminal`, `parseHcTerminal`, `HcEventType`, `Brand`, `brand`, `ok`, `err` | a client of the herdr-core (`hc`) socket: calls, the event feed with heartbeats, failures as `Unknown` values | the protocol-22 herdr socket |
| `@stateforge-labs/herdr-sdk/core/test-kit` | `FakeHcCore`, `setupTest(t)`, `openWorld()` | a scripted fake herdr-core for tests | production use |

Start with `connectReadOnly()`. A plugin that opens or closes its own panes uses `connectPlugin()`. Use `connectAdmin()` only for `*.close`, `server.*`, `agent.start`, `plugin.link/unlink/enable`: say why in a comment.

## Minimal use

```ts run
// fake: agent.list {"type":"agent_list","agents":[{"agent_status":"idle","focused":false,"pane_id":"p_1","revision":1,"tab_id":"t_1","terminal_id":"term_1","workspace_id":"w_1","name":"reviewer"}]}
import { connect, HerdrError } from "@stateforge-labs/herdr-sdk"

const herdr = await connect() // HERDR_SOCKET_PATH, else HERDR_SOCKET, else ~/.config/herdr/herdr.sock; pings; checks protocol 22
try {
  const { agents } = await herdr.agent.list({})
  for (const agent of agents) console.log(agent.name, agent.agent_status)
} catch (error) {
  if (error instanceof HerdrError) console.error(error.code, error.message)
  else throw error
} finally {
  herdr.close()
}
```

Methods are nested by their dotted wire name: `herdr.pane.list({})`, `herdr.agent.view.set({...})`. Every method takes one params object (`{}` when empty).

## Rules

- **Always** use the generated constants (`Method`, `EventKind`, `SubscriptionType`, `AgentStatus`, `WatchKind`, `ResultTag`), not raw strings: the types accept strings, but constants fail when herdr renames something.
- **Always** `close()` the client (or `await using` a held connection); a leaked client keeps the socket open.
- **Always** snapshot before you subscribe: a subscription delivers changes, not the present. `herdr.watch({ snapshot })` does snapshot, subscribe, replay and resubscribe for you. `update()` changes the subscription set (it re-subscribes and yields a new `Live`).
- **Always** pass `timeout_ms` to long-poll methods (`agent.wait`, `events.wait`, `pane.wait_for_output`): herdr would wait forever, and the types require it on `agent.wait`.
- **Never** resend `agent.prompt` after a timeout: a timeout is not proof the prompt was not delivered.
- **Never** assume `uint64` fields above 2^53 survive; they are JSON numbers.
- **Never** import from the package's `dist/` or `src/` paths; only the entries above.
- **Never** point tests at a real herdr. Use `createFakeHerdr()`.

## Where to go next

| Task | Read |
|---|---|
| Wait for an agent, prompt it, read output, split panes, subscribe, watch, test | `references/recipes.md` |
| An error or exception, what to catch, retry or not | `references/errors.md` |
| Which method exists, its params and result | `references/api-map.md` (namespaces and where the full list lives) |
| Versions, upgrades, drift against the installed herdr | `references/versions.md` |

## Verify

Run the type checker, then the code against the fake (`references/recipes.md`, "Test it"). Only point at the real socket when the owner says so.
