---
id: HERDR-ADR-0016
title: "Design intent inherited from atalaya: measured wire facts and client principles"
status: proposed
date: 2026-11-02
decision-makers: owner
summary: "The library adopts atalaya-bridge's herdr-client intent: wire facts measured on herdr 0.9.0 become transport rules and fake behaviours with tests, and atalaya's principles become library design rules. No atalaya work is implied."
---

# HERDR-ADR-0016: Design intent inherited from atalaya

Plan: [Design intent inherited from atalaya](../architecture/plan.md#design-intent-inherited-from-atalaya). C4: no element changes.

## Context and problem statement

atalaya-bridge measured herdr before it built a client, and recorded why in delivery-handbook ADR-0037 (2026-09-20, herdr 0.9.0, protocol 22), ADR-0041 (2026-09-20), the spine (AD-5, AD-9, AD-10) and `atalaya-bridge/AGENTS.md` / `NOTICE.md`. Its code has almost no comments (ADR-0048), so the intent lives only in those documents. The owner wants that intent in the library, not atalaya's open work finished. The library adopts each idea because the library needs it, and cites atalaya as the origin.

## Decision outcome

**Wire facts (W1-W4 = ADR-0037 facts 1-6, measured 2026-09-20, herdr 0.9.0, protocol 22; W5 = ADR-0037:30-35, measured; W6 = atalaya AGENTS.md:45-47, asserted not separately measured).** Each one is a transport rule and a fake behaviour, and each has a test.

| # | Fact | Transport rule | Fake behaviour and test |
|---|---|---|---|
| W1 | herdr closes after every response. A 2nd request on the same socket gets `BrokenPipe`, pipelined requests get 1 answer + `RST`. jsHerdrSDK measured the same on 0.8.2. | One connection per request. No id-correlation, no pipelining layer: `id` is an echo, not a key. | The fake closes after each non-subscribe response. Test: a client that reuses a connection fails. |
| W2 | `events.subscribe` acks `{"result":{"type":"subscription_started"}}`, then holds the connection and streams (18 s, 2 events). Responses carry `id`; events do not. | Demultiplex on "has `id`". A subscription owns its own connection. | `splitAck` and `strayLine` cases are tested. |
| W3 | An unparseable request gets `{"id":"","error":…}`, then EOF. | Accept an error envelope whose `id` is the request id or `""`. | An unparseable line gets `id:""` and a close. Test: the client rejects and does not hang. |
| W4 | `api.schema` over the socket returns `{}`. | Never generate from the socket. | If the fake implements `api.schema`, it returns `{}`. |
| W5 | A subscription delivers changes, not the present. 4 already-idle panes gave 1 frame (the ack) in 20 s, while the snapshot showed `w19:p1` blocked. | `watch` never emits `Live` before a snapshot. The watch path has no subscribe-only mode. | Subscribe replays no history. Test: removing the snapshot step makes `test/watch` fail, because an already-blocked pane appears only through the snapshot. |
| W6 | 3 of 27 subscribable types are per-pane (`pane.output_matched`, `pane.agent_status_changed`, `pane.scroll_changed`). The other 24 are global. | `watchPaneSet` subscribes pane by pane and maintains the set with `pane.created` and `pane.closed`. | A per-pane subscription without `pane_id` gets `invalid_params`. Test: `watchPaneSet` follows panes the fake creates and closes. |

**Principles adopted as design rules:**

- **P1, the CLI is a projection, not the API** (ADR-0037 decision 1, spine AD-5, `AGENTS.md:120-122`). 26 event kinds and 27 subscribable types are unreachable from the CLI. The runtime never spawns `herdr`. The CLI is used only at build time (`capture`) and by drift. Check: `src/wire` and `src/client` import no `node:child_process`.
- **P2, generated output is never hand-edited** (`AGENTS.md:95,106-107`). Generated files carry a banner. Checks: phase 1b asserts every file in `src/generated` starts with the banner, and the gate's regenerate + `git diff --exit-code` catches edits.
- **P3, an unknown event kind is surfaced, never guessed and never fatal** (ADR-0037 decision 5, spine AD-9). A push frame whose `event` is unknown is delivered as `UnknownFrame { rawEvent, raw }` and counted through `onUnknown`. It is never dropped, never coerced to a near kind, and never thrown from the iterator. The fake's `push` can emit one, and a test covers it.
- **P4, validate the envelope only** (ADR-0037 decision 5, spine AD-9). There is no runtime schema validator. Reversal condition: a consumer reads a field whose meaning it does not control. If that happens, validation goes at the decoder and nowhere else.
- **P5, a drift check that could not look exits 3, never 0** (`bin/herdr-drift.ts`, ADR-0037:207-208): "a gate that did not run is not green". See [HERDR-ADR-0009](HERDR-ADR-0009-schema-drift-and-protocol-tied-versioning.md).
- **P6, a bump is bounded and additive.** Protocol 20 to 22 added 11 methods and removed 0. Event kinds stayed at 26 and subscribable types at 27 (ADR-0037:91-105). This bound is what makes `minimum` safe next to `exact`, and it is re-checked at each bump ([HERDR-ADR-0009](HERDR-ADR-0009-schema-drift-and-protocol-tied-versioning.md)).
- **P7, conformist at the wire, anticorruption layer at the port** (spine AD-10, ADR-0037 decision 6). The library is the conformist adapter. A consumer keeps its own domain language behind its own port, and only one adapter file imports `@homelab/herdr`. The rule template `rules/consumer-single-adapter.dependency-cruiser.cjs` ships with the library and is self-tested by `lint:layers` in phase 1b ([HERDR-ADR-0006](HERDR-ADR-0006-domain-model-separate-from-wire-types.md)).
- **P8, split on a real consumer, not a predicted one** (ADR-0041 decision 3, `AGENTS.md:29-31,90-91`). Every subpath entry names a real consumer, verified by its imports. An entry without one does not ship in 1.0; `scripts/check-entries.ts` (phase 1b gate) fails when a `package.json` export has no named consumer ([HERDR-ADR-0003](HERDR-ADR-0003-layering-and-entry-points.md)).

The library already embodied the rest of the intent: generating from the schema (HERDR-ADR-0002), an unmapped method being a typing gap (the library goes further and fails the build), and declaring drift's missing CI. Those ADRs only gain the citation.

## Consequences

- Good: the fake now behaves like herdr where atalaya measured it, so a client that only works against a forgiving fake fails in `bun test`, not in production.
- Good: every rule has a dated origin, so the next herdr bump knows what to re-measure.
- Bad: the facts date from herdr 0.9.0, and the library targets 0.9.5. Phase 5b goldens re-confirm W1-W6 (W6 for the first time, since it was asserted, not measured), or mark them OPEN.
- Neutral: none of this is atalaya work. atalaya's openspec items, telemetry and migration are untouched.
