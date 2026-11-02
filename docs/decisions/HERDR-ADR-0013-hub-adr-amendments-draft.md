---
id: HERDR-ADR-0013
title: "Hub ADR-0030 and amendments: draft text for the voice hub"
status: proposed
date: 2026-11-02
decision-makers: owner
summary: "Holds the full draft of hub ADR-0030 (depend on @homelab/herdr, superseding hub ADR-0003) and the one-line amendments to hub ADR-0012, 0022, 0028 and 0029, to be copied into the hub in phase 6b."
---

# HERDR-ADR-0013: Hub ADR-0030 and amendments: draft text for the voice hub

Plan: [section 9](../architecture/plan.md#9-migration), [section 7](../architecture/plan.md#7-mcp-add-on). C4: none (document).

## Context and problem statement

The library's acceptance depends on hub decisions that do not exist yet. The hub's ADRs live in `plugins/crisap94.voice-engine/docs/decisions/` (last is ADR-0029) and are not edited from here.

## Decision outcome

Copy into the hub in phase 6b:

> **hub ADR-0030: Depend on the extracted @homelab/herdr package.** Status: proposed (accepted when S8 lands). Supersedes ADR-0003.
> *Context:* the hub vendors atalaya's herdr transport (`src/shared/vendor/atalaya/**`) and keeps its own `src/shared/infra/herdr/*`; atalaya keeps a second copy. `packages/herdr` now holds one generated, tested client.
> *Decision:* depend on `@homelab/herdr` via `hub/vendor/homelab-herdr-<version>.tgz` (exact version, sha256 checked), then the GitLab registry. Use `/effect` (`Herdr`, `HerdrReadOnly`, `watchPaneSet`), `/mcp` (`bearerGuard`, `tokenFile`) and `/test-kit` (`createFakeHerdr`). Delete the vendored copy and `infra/herdr/{herdr-client,wire,protocol-policy,socket-path}.ts`. Kernel errors re-export the library's with the same `_tag`s.
> *Consequences:* one copy of the client; the Containerfile copies `vendor/`; the library's protocol policy, backoff and fake are now hub dependencies.

One-line amendments (append to each hub ADR's Consequences):
- hub ADR-0012: "Amended by ADR-0030: the protocol policy (`exact`, protocol 22) is provided by `@homelab/herdr`."
- hub ADR-0022: "Amended by ADR-0030: subscribe-then-snapshot and the 1 s to 30 s backoff come from `watchPaneSet` in `@homelab/herdr/effect`."
- hub ADR-0028: "Amended by ADR-0030: MCP tool schemas use `effect/ai` (`Tool`, `Toolkit`), not zod; no MCP SDK."
- hub ADR-0029: "Amended by ADR-0030: the herdr fake is `createFakeHerdr` from `@homelab/herdr/test-kit`; live herdr runs stay in `test/contract/*.contract.ts` behind `bun run test:contract` and the owner's OK."

## Consequences

- Good: the hub change is ready to copy; reviewers see it with the library.
- Bad: the text may need edits if S7 changes before merging.
