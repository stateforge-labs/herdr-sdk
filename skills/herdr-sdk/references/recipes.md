# Recipes

Every `ts` block below is type-checked against the package by `test/skill/skill.test.ts`, and blocks marked `ts run` are executed against the fake herdr. Lines starting `// fake:` are the harness script (what the server answers); they are not part of your code. Copy them as written; `HERDR_SOCKET` or the default socket path picks the server.

## List agents and what they are doing

```ts run
// fake: agent.list {"type":"agent_list","agents":[{"agent_status":"idle","focused":false,"pane_id":"p_1","revision":1,"tab_id":"t_1","terminal_id":"term_1","workspace_id":"w_1","name":"reviewer"}]}
import { connectReadOnly } from "@stateforge-labs/herdr-sdk/read-only"

const herdr = await connectReadOnly()
const { agents } = await herdr.agent.list({})
for (const agent of agents) console.log(agent.name, agent.agent_status, agent.pane_id)
herdr.close()
```

## Take the present state in one call

`session.snapshot` returns workspaces, tabs, panes, agents and layouts together. Prefer it to many `*.list` calls.

```ts run
// fake: session.snapshot {"type":"session_snapshot","snapshot":{"agents":[],"layouts":[],"panes":[],"protocol":22,"tabs":[],"version":"0.9.5","workspaces":[]}}
import { connectReadOnly } from "@stateforge-labs/herdr-sdk/read-only"

const herdr = await connectReadOnly()
const { snapshot } = await herdr.session.snapshot({})
console.log(snapshot.workspaces.length, snapshot.tabs.length, snapshot.panes.length)
herdr.close()
```

## Wait for an agent to finish

The timeout is required in practice: without it herdr waits forever.

```ts run
// fake: agent.wait {"type":"agent_info","agent":{"agent_status":"idle","focused":false,"pane_id":"p_1","revision":1,"tab_id":"t_1","terminal_id":"term_1","workspace_id":"w_1","name":"reviewer"}}
import { connectReadOnly } from "@stateforge-labs/herdr-sdk/read-only"
import { AgentStatus } from "@stateforge-labs/herdr-sdk"

const herdr = await connectReadOnly()
const info = await herdr.agent.wait({ target: "reviewer", until: [AgentStatus.Done], timeout_ms: 60_000 })
console.log(info.agent.agent_status)
herdr.close()
```

## Prompt an agent

`connectPrompt()` can read structure and prompt, nothing else.

```ts run
// fake: agent.prompt {"type":"ok"}
import { connectPrompt } from "@stateforge-labs/herdr-sdk/read-only"
import { HerdrError, HerdrTransportError } from "@stateforge-labs/herdr-sdk"

const herdr = await connectPrompt()
try {
  await herdr.agent.prompt({ target: "reviewer", text: "run the tests" })
} catch (error) {
  if (error instanceof HerdrError) console.error("refused", error.code, error.message)
  else if (error instanceof HerdrTransportError) console.error("unknown whether delivered; do not resend blindly")
  else throw error
}
herdr.close()
```

## Read a pane's terminal output

Terminal content is a separate capability: `connect()` has it, `connectReadOnly()` needs `{ content: true }`.

```ts run
// fake: pane.read {"type":"pane_read","read":{"format":"text","pane_id":"p_1","revision":1,"source":"recent","tab_id":"t_1","text":"ok","truncated":false,"workspace_id":"w_1"}}
import { connectReadOnly } from "@stateforge-labs/herdr-sdk/read-only"

const herdr = await connectReadOnly({ content: true })
const { read } = await herdr.pane.read({ pane_id: "p_1", source: "recent", lines: 40 })
console.log(read)
herdr.close()
```

## Wait for output to match

```ts run
// fake: pane.wait_for_output {"type":"ok"}
import { connect } from "@stateforge-labs/herdr-sdk"

const herdr = await connect()
await herdr.pane.wait_for_output({
  pane_id: "p_1",
  source: "recent",
  match: { type: "regex", value: "tests? passed" },
  timeout_ms: 30_000,
})
herdr.close()
```

## Split a pane and run a command in it

`pane.split` is a write (`connect()`), not available on read-only clients.

```ts run
// fake: pane.split {"type":"ok"}
// fake: pane.send_text {"type":"ok"}
// fake: pane.send_keys {"type":"ok"}
import { connect } from "@stateforge-labs/herdr-sdk"

const herdr = await connect()
await herdr.pane.split({ direction: "right", target_pane_id: "p_1", cwd: "/tmp" })
await herdr.pane.send_text({ pane_id: "p_1", text: "echo hi" })
await herdr.pane.send_keys({ pane_id: "p_1", keys: ["Enter"] })
herdr.close()
```

## React to events (subscribe)

A subscription is an async iterable of frames. Subscribe, loop, `close()` when done.

```ts run
import { connectReadOnly } from "@stateforge-labs/herdr-sdk/read-only"
import { EventKind, SubscriptionType } from "@stateforge-labs/herdr-sdk/read-only"

const herdr = await connectReadOnly()
const subscription = await herdr.events.subscribe([
  { type: SubscriptionType.PaneCreated },
  { type: SubscriptionType.PaneClosed },
])
const stop = setTimeout(() => subscription.close(), 50)
for await (const frame of subscription) {
  if (frame.event === EventKind.PaneClosed) break
}
clearTimeout(stop)
subscription.close()
herdr.close()
```

## Keep a live view (watch)

`watch` takes a snapshot, subscribes, replays frames that arrived in between, and resubscribes with backoff after a drop. The first item is always `Live`. Frames can be replayed, so make your fold idempotent.

```ts
import { connectReadOnly } from "@stateforge-labs/herdr-sdk/read-only"
import { WatchKind } from "@stateforge-labs/herdr-sdk"

const herdr = await connectReadOnly()
const view = herdr.watch({ snapshot: () => herdr.session.snapshot({}) })
for await (const change of view) {
  if (change.kind === WatchKind.Live) console.log("snapshot", change.snapshot.snapshot.panes.length)
  else console.log("frame", change.frame)
}
```

## Change what a watch follows

`update(subscriptions)` replaces the subscription set: the watch re-subscribes, takes a fresh snapshot and yields a new `Live`. `idleMs` resubscribes after that long without a frame, so a quiet server does not leave the view stale.

```ts
import { connectReadOnly } from "@stateforge-labs/herdr-sdk/read-only"
import { SubscriptionType } from "@stateforge-labs/herdr-sdk"

const herdr = await connectReadOnly()
const view = herdr.watch({
  snapshot: () => herdr.session.snapshot({}),
  subscriptions: [{ type: SubscriptionType.WorkspaceCreated }],
  idleMs: 300_000,
})
view.update([{ type: SubscriptionType.WorkspaceCreated }, { type: SubscriptionType.WorkspaceClosed }])
view.close()
herdr.close()
```

## Test it (no real herdr)

The fake answers `ping`; every other method must be scripted with `fake.reply(method, result)`, otherwise herdr-style `unknown_method` is returned. It also lets you script failures, silence and pushes.

```ts run
import { connect, Method, ResultTag } from "@stateforge-labs/herdr-sdk"
import { createFakeHerdr } from "@stateforge-labs/herdr-sdk/test-kit"

const fake = await createFakeHerdr()
fake.reply(Method.AgentList, { type: ResultTag.AgentList, agents: [] })
const herdr = await connect({ socketPath: fake.path })

const { agents } = await herdr.agent.list({})
if (agents.length !== 0) throw new Error("expected no agents")
if (fake.receivedMethods().join() !== [Method.Ping, Method.AgentList].join()) throw new Error("unexpected calls")

herdr.close()
await fake.stop()
```

Other fake controls: `fail(method, error)`, `silent(method)` (for timeout tests), `replySequence`, `push(frame)`, `closeSubscribers()`, `subscriberCount()`, `capabilities`, `requests()`.
