---
id: HERDR-ADR-0004
title: "Promise core and Effect client, Effect as an optional peer"
status: proposed
date: 2026-11-02
decision-makers: owner
summary: "The core is Promise-based and Effect-free; /effect reuses the core's rpc, subscribe and hold and only maps errors and interruption, keeping the hub's tagged error names."
---

# HERDR-ADR-0004: Promise core and Effect client, Effect as an optional peer

Plan: [section 3.3](../architecture/plan.md#33-core-client-promise) and [3.7](../architecture/plan.md#37-effect-client). C4: `3 · Components / Core client`, `3 · Components / Effect client`.

## Context and problem statement

The hub is built with Effect 4 (hub ADR-0028; `hub/src/shared/infra/herdr/herdr-client.ts`, `hub/src/shared/kernel/herdr-errors.ts`) and decodes envelopes with its own Schemas (`hub/src/shared/infra/herdr/wire.ts`). atalaya and scripts run on Node without Effect (`src/client/rpc.ts`). Two decoders would validate the same envelope twice.

## Decision outcome

One wire under a Promise core. `/effect` wraps the core's `rpc`, `subscribe` and `hold`; it maps errors and interruption only; the hub's `wire.ts` Schemas are dropped. Its namespaces come from a generated `EffectClient` mapped type and one runtime wrapper. `effect` 4.1.2 is an optional peer.

| Core | Effect `_tag` |
|---|---|
| `HerdrError` | `HerdrRefused` (`method`, `code`, `message`) |
| `HerdrTransportError`, `SubscriptionEnded` | `HerdrUnavailable` (`cause`) |
| `ProtocolMismatchError` | `ProtocolMismatch` (`expected`, `actual`) |
| `UnsupportedByServerError` | `HerdrUnsupported` (`method`, `capability`) |
| interruption | connection destroyed |

## Consequences

- Good: hub `switch (error._tag)` code compiles unchanged; Node pays nothing for Effect.
- Bad: two public error vocabularies; the table above is repeated in the README.
