---
id: HERDR-ADR-0008
title: "Test kit and contract-test policy: no live endpoint by default"
status: proposed
date: 2026-11-02
decision-makers: owner
summary: "createFakeHerdr on node:net answers every method with a generated schema-valid default, checks request params, and backs one contract suite; live runs use the hub's *.contract.ts mechanism with owner OK."
---

# HERDR-ADR-0008: Test kit and contract-test policy: no live endpoint by default

Plan: [section 5](../architecture/plan.md#5-test-kit-and-contract-policy), phases 2a and 5a-5b in [section 9](../architecture/plan.md#9-delivery-phases). C4: `2 · Containers` (test-kit).

## Context and problem statement

Hub ADR-0029 forbids tests against live endpoints; the hub keeps live tests in `hub/test/contract/*.contract.ts`, excluded from `bun test`, run by `bun run test:contract` (`hub/package.json`). The hub fake (`hub/test/fakes/fake-herdr-server.ts`) uses `Bun.listen`. Destructive methods cannot be recorded, so goldens cannot provide every default.

## Decision outcome

A minimal node:net fake lands in phase 2a with the rpc tests; the full fake in 5a, ported from the hub fake. Default replies are generated from result schemas; goldens confirm. The fake checks params against a generated shape table and returns an error envelope on a bad request, and can advertise or omit server capabilities. Live runs: `test/contract/*.contract.ts` + `bun run test:contract`, owner OK each time, plus `HERDR_LIVE=1` and a scratch session.

## Consequences

- Good: Node and Bun consumers test the same way; wrong params fail in tests.
- Bad: generated defaults are minimal values, not realistic data.
