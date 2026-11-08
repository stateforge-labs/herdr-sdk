// Role: the LONG_POLL row of one method (its timeout path, the presence gate and the bounds), or undefined for a method that is not long-poll. Read from the generated table, never copied by hand.
// Informs HERDR-ADR-0007 and plan 3.6 (tools/gen/overrides.ts is the source); lane-internal to P4a.
import { LONG_POLL, type Method } from '../../generated/index.ts';
import type { LongPollMethod } from './types.ts';

export interface LongPollBounds {
  readonly exclusiveMin: number;
  readonly max: number;
}

export interface LongPollRule {
  readonly timeoutPath: readonly string[];
  readonly onlyWhenPresent?: string | undefined;
  readonly bounds?: LongPollBounds | undefined;
}

export function ruleOf(method: Method): LongPollRule | undefined {
  return isLongPollMethod(method) ? LONG_POLL[method] : undefined;
}

function isLongPollMethod(method: Method): method is LongPollMethod {
  return Object.hasOwn(LONG_POLL, method);
}
