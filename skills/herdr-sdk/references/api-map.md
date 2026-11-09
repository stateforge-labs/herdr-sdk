# API map

The authoritative list is generated and ships with the package: `docs/api/methods.md` and `docs/api/events.md`, or in code `import { METHODS } from "@stateforge-labs/herdr-sdk/schema"`. This page only orients you.

## Namespaces (method = `namespace.name`, called as `herdr.namespace.name(params)`)

`pane` (35, the largest: list, get, read, split, send_text, send_keys, wait_for_output, focus, close, ...), `agent` (12: list, get, read, start, prompt, wait, send_keys, rename, view.*), `plugin` (11), `workspace` (9), `tab` (7), `server` (6), `worktree` (4), `layout` (3), `integration` (3), `client` (3), `events` (subscribe, wait), `session` (snapshot), `ping`, plus single-method namespaces (`notification`, `popup`, `command`, `held`, ...).

## Capability classes (which entry has them)

| Class | Meaning | Examples | Entries |
|---|---|---|---|
| R-meta | read structure | `*.list`, `*.get`, `session.snapshot` | all |
| R-content | read terminal content | `pane.read`, `agent.read` | `connect`, `connectReadOnly({content:true})` |
| W | change UI or state | `*.rename`, `*.focus`, `pane.split` | `connect`, admin |
| I | input injection | `pane.send_text`, `agent.prompt` | `connect`, admin (prompt also `connectPrompt`) |
| H | hook reporter | `pane.report_*` | `connect`, admin |
| L | long-poll or stream | `agent.wait`, `events.wait`, `pane.wait_for_output`, `events.subscribe` | `connect`, admin, read-only (reads) |
| C | connection-bound | `client.window_title.set` | via `hold()` |
| X | spawns or executes | `agent.start`, `plugin.link`, `command.invoke` | admin only |
| D | destructive | `*.close`, `worktree.remove` | admin only |
| S | server control | `server.stop`, `server.reload_config` | admin only |

If a method you need is not on your client, it is deliberately out of that entry's class set. Widen the entry (with a stated reason), do not cast.

## Ids

Panes, tabs and workspaces are addressed by their ids (`p_1`-style strings from `*.list` or the snapshot). `agent.*` methods take a `target` (agent name or id).

## herdr-core (`./core`)

The reference for the herdr-core client is hand-written in `docs/api/core.md`.
