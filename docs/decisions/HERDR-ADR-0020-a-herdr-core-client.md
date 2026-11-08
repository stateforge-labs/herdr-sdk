---
id: HERDR-ADR-0020
title: "A typed client of the herdr-core socket, as the ./core entry"
status: accepted
date: 2026-11-08
decision-makers: owner
summary: "herdr-core (hc) has its own socket, NDJSON JSON-RPC 2.0 with an event stream. The SDK gets a standalone ./core entry for it (CoreLink, CoreEvents, wire parsers, the socket path rule) and a ./core/test-kit with a scripted fake core. It imports nothing from the protocol-22 layers."
---

# HERDR-ADR-0020: A typed client of the herdr-core socket

## Context and problem statement

The SDK speaks herdr's server socket (protocol 22). The newer herdr-core (`hc`, generation 1) has a different socket: newline-delimited JSON-RPC 2.0, a `hello` handshake, and `events.subscribe` that answers with a snapshot, then `event` notifications, a `heartbeat` every 15 s and `missed` with a fresh snapshot for a slow reader. Tools that talked to it spawned the `hc` CLI per call. The client was first written inside the tab-recap plugin (herdr-plugins), which now depends on this package instead.

## Decision outcome

- A new layer `core` (`src/core/`) with its own small value types (`src/core/kernel/`: Result, brand, Count, Text, time, Unknown, an async queue). It imports only itself and `node:` builtins, so it can be split out again without touching the protocol-22 code.
- `CoreLink`: one persistent connection, `hello` with the generation check, per-call timeouts, reconnect with capped backoff; failures are `Unknown` values, never thrown.
- `CoreEvents`: the event feed, with a heartbeat watchdog (two missed beats reconnect) and `missed` handled as a fresh snapshot.
- A new layer `core-test-kit` (`src/core/test-kit/`, only its entry imports it): `FakeHcCore` scripted from recorded frames, and `setupTest(t)` / `openWorld()` that close every link and stream with the test.
- Entries `./core` and `./core/test-kit`.

## Consequences

- Good: one home for the core client; consumers stop spawning `hc`.
- Bad: two value-type families in one package (the core kernel and the protocol-22 types) until they are merged.
- Open: the frames were recorded on hc 0.1.18 and 0.1.19; framed mode (attach) is not covered.
