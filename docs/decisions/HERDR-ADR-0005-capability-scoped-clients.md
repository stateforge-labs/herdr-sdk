---
id: HERDR-ADR-0005
title: "Capability-scoped clients and the admin subpath"
status: proposed
date: 2026-11-02
decision-makers: owner
summary: "Every method has a class; connect() excludes destructive, server-control and spawning methods, which live in /admin; read-only defaults to structure, not terminal content; enforced by flat types, a runtime allow-list and a test."
---

# HERDR-ADR-0005: Capability-scoped clients and the admin subpath

Plan: [section 3.4](../architecture/plan.md#34-capability-scoped-clients), classes in [section 4](../architecture/plan.md#4-api-coverage). C4: `2 · Containers`, `3 · Components / Core client`.

## Context and problem statement

The hub limits reads by hand (`hub/src/contexts/sessions/adapters/driven/constants.ts`: 5 methods; hub ADR-0026 excludes scrollback reads). Agents are untrusted (hub ADR-0017). herdr has `server.stop`, `*.close`, `plugin.link`, `command.invoke`; the schema carries no capability data. A README example that grants all of them by default invites misuse.

## Decision outcome

Classes in hand-kept `gen/capabilities.ts` (note per method): R-meta, R-content, W, I, H, L, C (connection-bound), X (spawns/executes), D, S. `pane.copy_motion`/`copy_search` are W until probed.

- `connect()` = R-meta, R-content, W, I, H, L, C. `connectAdmin()` (`/admin`) = all 102.
- `connectReadOnly()` = R-meta + L; R-content only with `{ content: true }`. With `{ methods }` it is exactly that list (long-poll excluded unless listed), a runtime filter with the `ReadOnlyClient` type; named presets (`Presets.SessionsReader`) get their own small type. `watch()` needs `session.snapshot` allowed.
- `connectPrompt()` = R-meta + `agent.prompt`.
- Enforcement: flat generated types per class (no tuple narrowing); runtime allow-list before sending; `fake.receivedMethods()` subset test; negative fixtures `test/types/*.ts` under `tsc --noEmit`; ast-grep `herdr-writes-only-in-adapter`.
- Effect: `HerdrReadOnly`, `HerdrPrompt`, `Herdr`, `HerdrAdmin`.

## Consequences

- Good: copying the README gives no destructive power; terminal content is opt-in.
- Bad: scripts that close panes import `/admin`; classes are judgement, reviewed per method.
