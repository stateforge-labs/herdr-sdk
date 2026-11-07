---
name: herdr-sdk
description: Write TypeScript or JavaScript that talks to a running herdr server (spaces/workspaces, tabs, panes, coding agents) through the typed @homelab/herdr client over herdr's unix socket. Use when code imports @homelab/herdr, or the task is to list, watch, prompt, wait on or read herdr panes and agents from a script, plugin, daemon or test, or to fake herdr in tests. Not for driving the herdr CLI by hand (hc skill) or the GUI window (herdr-app skill).
---

# @homelab/herdr

Typed client for herdr's socket API. Zero runtime dependencies, Bun and Node 22.18+. Targets **@homelab/herdr 0.1.0 = herdr protocol 22 (herdr 0.9.5)**.

## First: check the version

Do not trust memory of this API. Before writing code:

1. Read `node_modules/@homelab/herdr/package.json`: `version` and `herdr.protocol` must match the line above. If they differ, this skill may be stale; read the package's `docs/api/methods.md` and `docs/api/events.md` (generated from the schema, always current) before trusting any name here.
2. After editing, run the type checker. Param and result types are generated, so a wrong field name fails at compile time.

## Pick the entry point (least power that works)

| Import | Function | Can do | Cannot |
|---|---|---|---|
| `@homelab/herdr/read-only` | `connectReadOnly()` | structure reads (`*.list`, `*.get`, `session.snapshot`), long-poll waits, `events.subscribe`, `watch` | terminal content (opt in with `{ content: true }`), any write, generic `call()` |
| `@homelab/herdr/read-only` | `connectPrompt()` | structure reads + `agent.prompt` | everything else |
| `@homelab/herdr` | `connect()` | reads, content, UI changes, input, hooks, long-poll, `hold()` | destructive, server control, spawn/execute |
| `@homelab/herdr/admin` | `connectAdmin()` | all 102 methods | nothing |
| `@homelab/herdr/effect` | `Herdr` service + Layers | same as above as Effect (needs peer `effect` 4.1.2) | |
| `@homelab/herdr/test-kit` | `createFakeHerdr()` | in-process fake server for tests | production use |
| `@homelab/herdr/schema` | method table, param shapes | tooling that reflects on the API | |

Start with `connectReadOnly()`. Use `connectAdmin()` only for `*.close`, `server.*`, `agent.start`, `plugin.*`: say why in a comment.

## Minimal use

```ts run
// fake: agent.list {"type":"agent_list","agents":[{"agent_status":"idle","focused":false,"pane_id":"p_1","revision":1,"tab_id":"t_1","terminal_id":"term_1","workspace_id":"w_1","name":"reviewer"}]}
import { connect, HerdrError } from "@homelab/herdr"

const herdr = await connect() // HERDR_SOCKET, else ~/.config/herdr/herdr.sock; pings; checks protocol 22
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
- **Always** snapshot before you subscribe: a subscription delivers changes, not the present. `herdr.watch({ snapshot })` does snapshot, subscribe, replay and resubscribe for you.
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
