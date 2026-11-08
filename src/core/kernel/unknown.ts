// Role: Unknown: a call whose outcome cannot be known (timeout, unreachable, unreadable, not found, failed), as a value.
// Informs HERDR-ADR-0020 (the herdr-core client); ported from the desktop work in herdr-plugins.
import type { Duration } from './time.ts';

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
