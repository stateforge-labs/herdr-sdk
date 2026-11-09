# `@stateforge-labs/herdr-sdk`: client reference for plugin authors

This reference is written by hand. The generated references are `methods.md` and `events.md` in this folder.

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

`connectPlugin()` reads the socket path the same way as `connect()`: an explicit `socketPath`, else `HERDR_SOCKET`, else `~/.config/herdr/herdr.sock`.

```bash
HERDR_SOCKET=/run/user/1000/herdr/herdr.sock bun run plugin.ts
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
