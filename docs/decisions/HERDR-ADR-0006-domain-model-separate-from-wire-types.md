---
id: HERDR-ADR-0006
title: "Domain model separate from wire types (deferred to its first consumer)"
status: proposed
date: 2026-11-02
decision-makers: owner
summary: "/model is built in phase 7 with atalaya's reducers as first consumer: pure entities with no wire imports, and one mapper file that alone may name generated types."
---

# HERDR-ADR-0006: Domain model separate from wire types (deferred to its first consumer)

Plan: [section 3.5](../architecture/plan.md#35-domain-model-deferred). C4: `2 · Containers` (model, planned).

## Context and problem statement

atalaya's reducers (`src/reducers/{fleet-state,from-snapshot,apply-event}.ts`) mix event names (`apply-event.ts:54-62`). A model whose `fromSnapshot(wire)` takes wire types cannot also promise "no wire types in its signatures". The hub keeps its own kernel mapping (`hub/src/shared/infra/herdr/mappers.ts`), so no consumer before atalaya needs a model.

## Decision outcome

Defer `/model` to phase 7. Then: `model/entities.ts` (readonly entities, branded ids, no wire import) and `model/from-wire.ts` (`fromSnapshot`, `applyEvent`), the only model file allowed to import `generated`; rule `generated <- model/from-wire.ts`. Acceptance: atalaya's reducer tests pass on it. The predicate "no generated wire type in ports/domain" (atalaya `ci/domain-types/scope.ts:28-30`) ships as a rule template. Framing (spine AD-10, ADR-0037 decision 6, [HERDR-ADR-0016](HERDR-ADR-0016-design-intent-inherited-from-atalaya.md) P7): the library is conformist at the wire. A consumer keeps an anticorruption layer at its own port, and only one adapter file imports `@homelab/herdr`.

## Consequences

- Good: no unused code ships; the model is shaped by a real consumer.
- Bad: atalaya keeps its reducers until phase 7.
