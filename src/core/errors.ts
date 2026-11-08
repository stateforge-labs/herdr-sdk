// Role: every failure of the herdr-core client and its kinds as objects (ParseFailureKind, UnknownWhy, OutcomeKind): Unknown (a call whose outcome cannot be known), ParseFailure (why a parser refused) and CoreInvariantError (a load-time constant refused, a bug).
// Informs HERDR-ADR-0020; merged by HERDR-ADR-0021 from parse-failure.ts, unknown.ts.
import type { Duration } from './kernel.ts';

export const ParseFailureKind = {
  NotAString: 'not-a-string',
  NotANumber: 'not-a-number',
  Empty: 'empty',
  NotAnInteger: 'not-an-integer',
  NotARow: 'not-a-row',
  OutOfRange: 'out-of-range',
} as const;

export type ParseFailureKind = (typeof ParseFailureKind)[keyof typeof ParseFailureKind];

export type ParseFailure = { readonly kind: ParseFailureKind };

export const CoreErrorName = { Invariant: 'CoreInvariantError' } as const;

// A load-time constant failed its own parser: a bug in the SDK, never a runtime condition.
export class CoreInvariantError extends Error {
  override readonly name: string = CoreErrorName.Invariant;

  constructor(detail: string) {
    super(`a load-time constant was refused: ${detail}`);
  }
}

export const UnknownWhy = {
  Timeout: 'timeout',
  Unreadable: 'unreadable',
  Unreachable: 'unreachable',
  NotFound: 'not-found',
  Failed: 'failed',
} as const;

export type UnknownWhy = (typeof UnknownWhy)[keyof typeof UnknownWhy];

// What a call settled as: an answer from the core, or Unknown.
export const OutcomeKind = { Answer: 'answer', Unknown: 'unknown' } as const;

export type OutcomeKind = (typeof OutcomeKind)[keyof typeof OutcomeKind];

export type Unknowable =
  | { readonly why: typeof UnknownWhy.Timeout; readonly after: Duration }
  | { readonly why: typeof UnknownWhy.Unreadable; readonly detail: string }
  | { readonly why: typeof UnknownWhy.Unreachable; readonly detail: string }
  | { readonly why: typeof UnknownWhy.NotFound; readonly what: string }
  | { readonly why: typeof UnknownWhy.Failed; readonly code: number; readonly detail: string };

export type Unknown = { readonly kind: typeof OutcomeKind.Unknown; readonly why: Unknowable };

export function unknown(why: Unknowable): Unknown {
  return { kind: OutcomeKind.Unknown, why };
}

export function isUnknown<T extends { readonly kind: string }>(value: T | Unknown): value is Unknown {
  return value.kind === OutcomeKind.Unknown;
}
