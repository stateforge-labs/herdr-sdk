---
id: HERDR-ADR-0007
title: "Subscriptions, long-poll and held connections"
status: proposed
date: 2026-11-02
decision-makers: owner
summary: "Subscriptions are async iterators and Streams on a dedicated connection; watch replays frames buffered during the snapshot; long-poll timeouts are required per a generated override table; connection-bound methods run on a held connection."
---

# HERDR-ADR-0007: Subscriptions, long-poll and held connections

Plan: [section 3.6](../architecture/plan.md#36-subscriptions-long-poll-and-held-connections). C4: `3 · Components / Core client` (subscribe, watch, held).

## Context and problem statement

The hub's `openSubscription` (`hub/src/shared/infra/herdr/herdr-client.ts:52-127`) is hardened; the fleet adapter (`herdr-agent-fleet.ts:96-165`) has the subscribe-then-snapshot loop (hub ADR-0022). `SessionSnapshot` has no revision. Long-poll timeouts sit at different paths (`timeout_ms`, `wait.timeout_ms`, bounded `agent.start` `timeout_ms`, `herdr-schema.json:1359`). Four methods are connection-scoped (`server.ssh_agent.register`, `:3887`; `client_shell.surface.set`, `:1699`; `client.window_title.set/clear`) and end when a per-request connection closes.

## Decision outcome

- `PushFrame = EventFrame | SubscriptionEventFrame`; mapping and gaps generated into `docs/api/events.md` and asserted (7 kinds not awaitable, `pane_output_changed` not subscribable).
- `events.subscribe` → `AsyncIterable` + `close()`; bounded queue optional with `Overflow.DropOldest | Overflow.Fail`.
- `watch`/`watchPaneSet`: frames between ack and snapshot are buffered and replayed through an idempotent fold; resubscribe with backoff 1 s to 30 s.
- `gen/overrides.ts` (method → required timeout path, bounds, return type, capability gate) drives the types; rpc timeout = timeout + margin.
- Class C methods only on `herdr.hold()` → `Held` with `close()`; gated by `pong.capabilities`.

## Consequences

- Good: no infinite waits; no silent loss of a registration or lease.
- Bad: params stricter than the schema; one more hand table, checked by the generator.
