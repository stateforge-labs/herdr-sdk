// Role: the /effect entry. Until amendment A1 (effect pinned, 2026-11-16) it exposes only the effect-free contract: layer options, error shapes, toTaggedError.
// Informs HERDR-ADR-0003, HERDR-ADR-0004 and HERDR-ADR-0017; edited only by the integration step.
export { toTaggedError } from './effect/to-tagged-error.ts';
export { EffectErrorTag } from './constants.ts';
export type * from './effect/types.ts';
