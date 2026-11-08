// Role: every failure of the herdr-core client: Unknown (a call whose outcome cannot be known), ParseFailure (why a parser refused) and CoreInvariantError (a load-time constant refused, a bug).
// Informs HERDR-ADR-0020; merged by HERDR-ADR-0021 from parse-failure.ts, unknown.ts.
import type { Duration } from './kernel.ts';

export type ParseFailure =
  | { readonly kind: 'not-a-string' }
  | { readonly kind: 'not-a-number' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'not-an-integer' }
  | { readonly kind: 'not-a-row' }
  | { readonly kind: 'out-of-range' };

// A load-time constant failed its own parser: a bug in the SDK, never a runtime condition.
export class CoreInvariantError extends Error {
  override readonly name: string = 'CoreInvariantError';

  constructor(detail: string) {
    super(`a load-time constant was refused: ${detail}`);
  }
}

export type Unknowable =
  | { readonly why: 'timeout'; readonly after: Duration }
  | { readonly why: 'unreadable'; readonly detail: string }
  | { readonly why: 'unreachable'; readonly detail: string }
  | { readonly why: 'not-found'; readonly what: string }
  | { readonly why: 'failed'; readonly code: number; readonly detail: string };

export type Unknown = { readonly kind: 'unknown'; readonly why: Unknowable };

export function unknown(why: Unknowable): Unknown {
  return { kind: 'unknown', why };
}
