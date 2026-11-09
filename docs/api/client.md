# `@stateforge-labs/herdr-sdk`: client reference for plugin authors

This reference is written by hand. The generated references are `methods.md` and `events.md` in this folder.

## Socket discovery

`connect()`, `connectAdmin()` and `connectPlugin()` pick the socket in this order. An empty variable counts as unset.

1. The `socketPath` option.
2. `HERDR_SOCKET_PATH`, the variable herdr sets for plugins and pane processes.
3. `HERDR_SOCKET`, the SDK's older name. It is kept for compatibility; herdr itself does not set it.
4. `~/.config/herdr/herdr.sock`.

The herdr 0.9.5 binary sets `HERDR_SOCKET_PATH` next to `HERDR_PLUGIN_ROOT` and `HERDR_PANE_ID` in the environment it gives plugin and pane processes. It never sets a bare `HERDR_SOCKET`. `HERDR_CLIENT_SOCKET_PATH` is the GUI client's own socket (`herdr-client.sock`), not the API socket, so the SDK does not read it.

## `connectPlugin(options?)`

```ts
import { connectPlugin } from '@stateforge-labs/herdr-sdk';

function connectPlugin(options?: ConnectOptions): Promise<PluginClient>;
```

`connectPlugin()` is the client for a plugin that runs inside herdr. It takes the same `ConnectOptions` as `connect()` (socket path, timeout, protocol policy, `onCall`), pings the server, checks the protocol, and resolves to a `PluginClient`. It rejects like `connect()` when the socket is missing or the protocol does not match.

The method set is `connect()`'s 77 methods plus two: `plugin.pane.open` and `plugin.pane.close`. `plugin.pane.focus` and `plugin.disable` are already in `connect()`. Calls outside this set throw `HerdrTransportError` before anything is sent.

`PluginClient` has the same members as the `connect()` client: the namespaces, `watch`, `hold()` and `call()` for the allowed methods. A `call()` for any method outside the list rejects with `HerdrTransportError` and never reaches the server.

### Methods

| Namespace | Methods |
| --- | --- |
| `agent` | `explain`, `focus`, `get`, `list`, `prompt`, `read`, `rename`, `send_keys`, `view.clear`, `view.set`, `wait` |
| `events` | `subscribe`, `wait` |
| `integration` | `list` |
| `layout` | `apply`, `export`, `set_split_ratio` |
| `notification` | `show` |
| `pane` | `clear`, `clear_agent_authority`, `copy_motion`, `copy_search`, `current`, `edges`, `focus`, `focus_direction`, `get`, `input.set`, `layout`, `link.resolve`, `list`, `move`, `neighbor`, `process_info`, `read`, `release_agent`, `rename`, `report_agent`, `report_agent_session`, `report_metadata`, `resize`, `scroll`, `selection.read`, `send_input`, `send_keys`, `send_text`, `split`, `swap`, `wait_for_output`, `zoom` |
| `ping` (top level) | `ping` |
| `plugin` | `action.list`, `disable`, `list`, `log.list`, `pane.focus`, `pane.open`, `pane.close` |
| `product_announcement` | `dismiss` |
| `release_notes` | `dismiss` |
| `server` | `agent_manifests` |
| `session` | `snapshot` |
| `tab` | `create`, `focus`, `get`, `list`, `move`, `rename` |
| `workspace` | `create`, `focus`, `get`, `list`, `move`, `move_block`, `rename`, `report_metadata` |
| `worktree` | `create`, `list`, `open` |

`pane.open` and `pane.close` are the two methods added for plugins. The rest are the `connect()` set: reads, content, UI changes, input, hooks and long-poll waits. Destructive methods (`pane.close`, `tab.close`), server control (`server.stop`), spawning (`agent.start`) and plugin link, unlink and enable (`plugin.link`, `plugin.unlink`, `plugin.enable`) are not in this list. Use `connectAdmin()` from `@stateforge-labs/herdr-sdk/admin` for them, and say why in a comment.

### Not a sandbox

The method list limits what the SDK client sends. It is not a security boundary. Herdr does not limit the plugin ids a caller names, and the plugin runs with the user's account, so any process that can open the socket can do what this client does. Do not treat `connectPlugin()` as a way to contain untrusted code.

### Environment

`connectPlugin()` reads the socket path the same way as `connect()` (see Socket discovery): an explicit `socketPath`, else `HERDR_SOCKET_PATH`, else `HERDR_SOCKET`, else `~/.config/herdr/herdr.sock`.

```bash
HERDR_SOCKET_PATH=/run/user/1000/herdr/herdr.sock bun run plugin.ts
```

## `PluginClient`

`PluginClient` is the type `connectPlugin()` resolves to, and `ConnectPlugin` is the type of the function itself. It is the `connect()` client type with the plugin method set. Import it as a type:

```ts
import type { PluginClient } from '@stateforge-labs/herdr-sdk';
```

## Typed plugin pane results

`plugin.pane.open`, `plugin.pane.focus` and `plugin.pane.close` return typed results instead of `unknown`:

| Method | Params | Result tag |
| --- | --- | --- |
| `plugin.pane.open` | `PluginPaneOpenParams` | `plugin_pane_opened` |
| `plugin.pane.focus` | `PluginPaneFocusParams` | `plugin_pane_focused` |
| `plugin.pane.close` | `PluginPaneCloseParams` | `plugin_pane_closed` |

`plugin_pane_opened` carries the new pane, so `result.plugin_pane.pane.pane_id` is a `string`. `plugin_pane_closed` carries `pane_id` as a `string`.

## Example: open a split pane with an environment

```ts
import { connectPlugin } from '@stateforge-labs/herdr-sdk';

const herdr = await connectPlugin();

const opened = await herdr.plugin.pane.open({
  plugin_id: 'example-plugin',
  entrypoint: 'panel',
  placement: 'split',
  direction: 'right',
  focus: false,
  env: { EXAMPLE_MODE: 'compact' },
});

const paneId = opened.plugin_pane.pane.pane_id;

await herdr.plugin.pane.close({ pane_id: paneId });
herdr.close();

```

`env` values are strings. `focus` defaults to `false`. `direction` is `"right"` or `"down"`.

## `ErrorCode`

```ts
import { ErrorCode } from '@stateforge-labs/herdr-sdk';

const ErrorCode: {
  readonly AgentBlocked: 'agent_blocked';
  readonly AgentNotFound: 'agent_not_found';
  readonly AgentPromptStalled: 'agent_prompt_stalled';
};
type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
```

`ErrorCode` holds the codes herdr sends in `HerdrError.code` for agent calls. `HerdrError.code` stays `string`, because herdr may send codes this version does not know. Compare with `error.code === ErrorCode.AgentBlocked` after an `instanceof HerdrError` check. Meanings and what to do are in `skills/herdr-sdk/references/errors.md`.

## `UnsupportedWatchError`

```ts
class UnsupportedWatchError extends TypeError {
  readonly name: 'UnsupportedWatchError';
}
```

`watchPaneSet()` throws it synchronously when `types` includes `pane.output_matched`. That type needs a single pane's subscription, which the per-pane set cannot follow. It is a `TypeError` because it is an argument error: no request was sent. Check it with `instanceof UnsupportedWatchError` across the package boundary.

## `SubscriptionEventKind`

```ts
import { SubscriptionEventKind } from '@stateforge-labs/herdr-sdk';

const SubscriptionEventKind: {
  readonly PaneOutputMatched: 'pane.output_matched';
  readonly PaneAgentStatusChanged: 'pane.agent_status_changed';
  readonly PaneScrollChanged: 'pane.scroll_changed';
};
type SubscriptionEventKind = (typeof SubscriptionEventKind)[keyof typeof SubscriptionEventKind];
```

The event names of per-pane subscriptions. The generated `SubscriptionType` values are the subscription requests; these are the event names that come back in frames.

## `Watch.update`

```ts
interface Watch<S> extends AsyncIterable<WatchChange<S>> {
  close(): void;
  update(subscriptions: readonly Subscription[]): void;
}
```

Replaces the subscription set of a `watch()`. A different set (order does not count) closes the current subscription, re-subscribes with the new specs, takes a fresh snapshot and yields a new `Live`. The consumer's rule does not change: a `Live` replaces its state, and frames after it are the new set's. An equal set is a no-op.

| Call made | Effect |
| --- | --- |
| before iteration | only changes the initial set |
| during a backoff sleep | cuts the sleep short; the new set subscribes at once, and no further backoff is requested |
| while the snapshot is pending | aborts the snapshot (its signal is aborted); the new snapshot is used |
| after `close()` | no-op |

An update restart is not a failure: it applies no backoff and does not change the attempt count. `update` never throws. The Effect twin (`watch` from `./effect`) does not expose `update`; use the client's `watch()` for a changing set.

## `WatchOptions.idleMs`

```ts
interface WatchOptions<S> {
  idleMs?: number | undefined;
}
```

Resubscribes after `idleMs` without a frame. After each frame, and at the start of each cycle, an idle wait is armed; a frame replaces it. If the wait expires, the watch resubscribes with a fresh snapshot and yields a new `Live`, as `Watch.update` does, with no backoff and no change to the attempt count. `close()` aborts the pending wait.

herdr sends no heartbeats on a subscription, so a quiet server restarts every `idleMs`. Use a large value, for example `300000` (five minutes).

| Value | Effect |
| --- | --- |
| `undefined` (default) | off |
| finite and above 0 | an idle wait of that many ms |
| `0`, negative, `NaN` or `Infinity` | off, no error |

The wait uses the injectable `sleep` option, so tests never wait for real time.

