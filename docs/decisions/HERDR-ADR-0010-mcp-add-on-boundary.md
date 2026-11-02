---
id: HERDR-ADR-0010
title: "MCP add-on boundary: Effect-AI, read-only, out of the core"
status: proposed
date: 2026-11-02
decision-makers: owner
summary: "@homelab/herdr/mcp builds read-only MCP tools on effect/ai as S7 does, amends hub ADR-0028's zod edge rule, and ships only after S7 merges."
---

# HERDR-ADR-0010: MCP add-on boundary: Effect-AI, read-only, out of the core

Plan: [section 7](../architecture/plan.md#7-mcp-add-on), phase 6c. C4: `2 · Containers` (mcp).

## Context and problem statement

Hub ADR-0028 (accepted) says "zod stays for the MCP tool schemas (the MCP SDK expects it)". S7, not merged, uses `effect/ai` instead: `hub/src/contexts/sessions/adapters/driving/mcp-http.ts` imports `McpServer` from `effect/ai`, `sessions-toolkit.ts` imports `Tool, Toolkit` (worktree `sessions-mcp`). The hub on main has no zod and no MCP SDK.

## Decision outcome

`/mcp` exports `readOnlyToolkit({ methods })` (R-meta only, `readOnlyHint: true`), `bearerGuard`, `tokenFile`, `toolResult`, on `effect/ai` (Effect as peer), using only the read-only client ([HERDR-ADR-0005](HERDR-ADR-0005-capability-scoped-clients.md)). It **amends hub ADR-0028**: MCP tool schemas via `effect/ai`, not zod (draft in [HERDR-ADR-0013](HERDR-ADR-0013-hub-adr-amendments-draft.md)). Ships only after S7 merges; if S7 lands without `effect/ai`, `/mcp` leaves 1.0.

Rule widened to all entries by [HERDR-ADR-0003](HERDR-ADR-0003-layering-and-entry-points.md) and [HERDR-ADR-0016](HERDR-ADR-0016-design-intent-inherited-from-atalaya.md) P8 (`scripts/check-entries.ts`).

## Consequences

- Good: an MCP over herdr is a few lines and cannot write.
- Open: a Node SDK variant for atalaya (plan open question 4).
