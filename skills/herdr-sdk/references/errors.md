# Errors

Five Promise error classes, all exported from `@homelab/herdr`. Check with `instanceof`.

| Class | Meaning | Fields | Retry? |
|---|---|---|---|
| `HerdrError` | herdr received the call and refused it (error envelope) | `code`, `method`, `body`, `message` | No: fix the params or the target |
| `HerdrTransportError` | no usable answer: cannot connect, timeout, abort, socket closed, malformed line | `isTimeout`, `cause` | Reads: yes. `agent.prompt` and other input methods: **no**, delivery is unknown |
| `ProtocolMismatchError` | the server speaks another protocol than this client (`connect()` default is exact) | `expected`, `actual` | No: upgrade the package or run the matching herdr |
| `UnsupportedByServerError` | the method needs a server capability herdr did not advertise; nothing was sent | `method`, `capability` | No |
| `SubscriptionEnded` | the server closed a subscription connection | `method` | `watch()` resubscribes for you; with raw `events.subscribe` you resubscribe yourself and re-snapshot |

Notes:

- `connect()` rejects when there is no socket; the message names the path. Check that herdr is running and that `HERDR_SOCKET` points at the server you mean.
- A closed client rejects later calls with `HerdrTransportError` without contacting herdr; `close()` also ends its subscriptions, watch loops and held connections.
- The default per-request timeout is 10 s (`timeoutMs` option). Long-poll methods add their own `timeout_ms`.
- `onCall({ method, durationMs, outcome })` on `connect()` options is the metrics hook; `onUnknown(frame)` receives push frames of kinds this version does not know (herdr may add some): log and ignore them.
- Effect entry: the same errors are tagged: `HerdrRefused`, `HerdrUnavailable` (transport and subscription end; `isTimeout`), `ProtocolMismatch`, `HerdrUnsupported`.
