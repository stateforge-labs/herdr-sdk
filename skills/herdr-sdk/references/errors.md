# Errors

Six error classes, all exported from `@stateforge-labs/herdr-sdk`. Check with `instanceof`.

| Class | Meaning | Fields | Retry? |
|---|---|---|---|
| `HerdrError` | herdr received the call and refused it (error envelope) | `code`, `method`, `body`, `message` | No: fix the params or the target |
| `HerdrTransportError` | no usable answer: cannot connect, timeout, abort, socket closed, malformed line | `isTimeout`, `cause` | Reads: yes. `agent.prompt` and other input methods: **no**, delivery is unknown |
| `ProtocolMismatchError` | the server speaks another protocol than this client (`connect()` default is exact) | `expected`, `actual` | No: upgrade the package or run the matching herdr |
| `UnsupportedByServerError` | the method needs a server capability herdr did not advertise; nothing was sent | `method`, `capability` | No |
| `SubscriptionEnded` | the server closed a subscription connection | `method` | `watch()` resubscribes for you; with raw `events.subscribe` you resubscribe yourself and re-snapshot |
| `UnsupportedWatchError` | a `TypeError` thrown synchronously by `watchPaneSet()` for `pane.output_matched`, which it cannot follow per pane; nothing is sent | `message` | No: drop the type from `types` |

Notes:

- `connect()` rejects when there is no socket; the message names the path. Check that herdr is running and that `HERDR_SOCKET` points at the server you mean.
- A closed client rejects later calls with `HerdrTransportError` without contacting herdr; `close()` also ends its subscriptions, watch loops and held connections.
- The default per-request timeout is 10 s (`timeoutMs` option). Long-poll methods add their own `timeout_ms`.
- `onCall({ method, durationMs, outcome })` on `connect()` options is the metrics hook; `onUnknown(frame)` receives push frames of kinds this version does not know (herdr may add some): log and ignore them.
- Effect entry: the same errors are tagged: `HerdrRefused`, `HerdrUnavailable` (transport and subscription end; `isTimeout`), `ProtocolMismatch`, `HerdrUnsupported`.

## Codes of a HerdrError

`HerdrError.code` is a string. The schema has no enum for it, so the SDK keeps the three agent codes as `ErrorCode` and leaves every other code as the string herdr sent. Compare with the member, not a literal:

```ts
import { ErrorCode, HerdrError } from '@stateforge-labs/herdr-sdk';

export function isBlocked(error: unknown): boolean {
  return error instanceof HerdrError && error.code === ErrorCode.AgentBlocked;
}
```

| `ErrorCode` member | Wire value | Meaning | What to do |
|---|---|---|---|
| `AgentBlocked` | `agent_blocked` | the agent waits on a dialog and cannot take input | do not retry the prompt; answer the dialog or stop |
| `AgentNotFound` | `agent_not_found` | the pane or agent is gone | do not retry the same target; list again before any new call |
| `AgentPromptStalled` | `agent_prompt_stalled` | the prompt may or may not have been delivered | do not resend; read the pane to see whether it arrived |

`SubscriptionEventKind` names the per-pane event types (`pane.output_matched`, `pane.agent_status_changed`, `pane.scroll_changed`). An unknown code or event type is not an error: keep it as a string and handle it in the default branch.
