---
id: HERDR-ADR-0011
title: "Consumer migration and distribution (tarball, then registry)"
status: proposed
date: 2026-11-02
decision-makers: owner
summary: "The hub moves first through a checksummed packed tarball as hub slice S8 after S7 merges, atalaya later through the GitLab registry (release-asset fallback); hub ADR changes are drafted in HERDR-ADR-0013."
---

# HERDR-ADR-0011: Consumer migration and distribution (tarball, then registry)

Plan: [section 2 consumption](../architecture/plan.md#2-location-packaging-versioning-runtimes-dependencies) and [section 9](../architecture/plan.md#9-migration). C4: `1 · Context`.

## Context and problem statement

Hub ADR-0003 says "copy, do not depend" (`plugins/crisap94.voice-engine/docs/decisions/ADR-0003-copy-atalaya-herdr-transport-pruned-do-not-depend-on-the.md`). The hub `Containerfile` copies only `package.json bun.lock` before `bun install --frozen-lockfile --production` (lines 12-13). atalaya is another repo on pnpm/Node.

## Decision outcome

- Hub (phase 6b, entry criterion S7 merged): `hub/vendor/homelab-herdr-<version>.tgz` with sha256 in `hub/vendor/SHA256SUMS`; `Containerfile` adds `COPY vendor ./vendor` before install; mise `herdr:pack` repacks and the gate compares checksums; dev loop uses `bun link`. Migration rows in plan section 9 (including what stays in sessions and control).
- Hub ADR-0030 supersedes hub ADR-0003 and amends hub ADR-0012, 0022, 0028, 0029; text in [HERDR-ADR-0013](HERDR-ADR-0013-hub-adr-amendments-draft.md), copied into the hub, not edited here.
- atalaya (phase 7): GitLab registry, fallback release asset; its own ADR.
- Rejected: a root Bun workspace (image context and lockfile merge).

## Consequences

- Good: stale tarballs are caught; rollback = restore the vendored copy.
- Bad: one Containerfile change and a manual pack step until the registry exists.
