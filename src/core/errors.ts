// Role: every failure of the herdr-core client ; its kinds live in constants.ts: Unknown (a call whose outcome cannot be known), ParseFailure (why a parser refused) and CoreInvariantError (a load-time constant refused, a bug).
// Informs HERDR-ADR-0020; merged by HERDR-ADR-0021 from parse-failure.ts, unknown.ts.
import { CoreErrorName, CoreText, OutcomeKind } from './constants.ts';
import type { ParseFailureKind, UnknownWhy } from './constants.ts';
import type { Duration } from './kernel.ts';

export type ParseFailure = { readonly kind: ParseFailureKind };


// A load-time constant failed its own parser: a bug in the SDK, never a runtime condition.
export class CoreInvariantError extends Error {
  override readonly name: string = CoreErrorName.Invariant;

  constructor(detail: string) {
    super(CoreText.Invariant(detail));
  }
}

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
