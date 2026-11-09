// Role: the core entry ("./core"): a typed client of the herdr-core socket (herdr generation 1): CoreLink for calls, CoreEvents for the event feed, the wire parsers and the socket path rule.
// Informs HERDR-ADR-0020 (the herdr-core client); ported from the desktop work in herdr-plugins.
export * from './core/backoff.ts';
export * from './core/constants.ts';
export * from './core/events.ts';
export * from './core/link.ts';
export * from './core/wire.ts';
export { duration } from './core/kernel.ts';
export type { Duration, Instant } from './core/kernel.ts';
export { parseCount } from './core/kernel.ts';
export type { Count } from './core/kernel.ts';
export { parseNonEmptyText, parseText } from './core/kernel.ts';
export type { NonEmptyText, Text } from './core/kernel.ts';
export { byKind, isErr, isOk, must } from './core/kernel.ts';
export type { Err, KindMap, KindOf, Ok, Result } from './core/kernel.ts';
export { CoreInvariantError, isUnknown, unknown } from './core/errors.ts';
export type { ParseFailure, Unknowable, Unknown } from './core/errors.ts';
export * from './core/terminal.ts';
export * from './core/roster.ts';
export { parsePositiveCount } from './core/kernel.ts';
export type { PositiveCount } from './core/kernel.ts';
