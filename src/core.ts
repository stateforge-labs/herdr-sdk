// Role: the core entry ("./core"): a typed client of the herdr-core socket (herdr generation 1): CoreLink for calls, CoreEvents for the event feed, the wire parsers and the socket path rule.
// Informs HERDR-ADR-0020 (the herdr-core client); ported from the desktop work in herdr-plugins.
export * from './core/backoff.ts';
export * from './core/constants.ts';
export * from './core/events.ts';
export * from './core/link.ts';
export * from './core/wire.ts';
export { duration } from './core/kernel/time.ts';
export type { Duration, Instant } from './core/kernel/time.ts';
export { parseCount } from './core/kernel/count.ts';
export type { Count } from './core/kernel/count.ts';
export { parseNonEmptyText, parseText } from './core/kernel/text.ts';
export type { NonEmptyText, Text } from './core/kernel/text.ts';
export { must } from './core/kernel/result.ts';
export type { Result } from './core/kernel/result.ts';
export { unknown } from './core/kernel/unknown.ts';
export type { Unknowable, Unknown } from './core/kernel/unknown.ts';
