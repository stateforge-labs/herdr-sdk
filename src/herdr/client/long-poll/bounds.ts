// Role: refuses a long-poll timeout_ms outside the method's bounds before anything is sent (agent.start: greater than 3000 and at most 300000).
// Informs HERDR-ADR-0007, plan 3.6 and the LONG_POLL bounds in tools/gen/overrides.ts; contract in client/long-poll/types.ts (AssertLongPollBounds).
import { HerdrTransportError } from '../../wire/errors.ts';
import { LongPollText } from './constants.ts';
import { isNumber, readPath } from './read-path.ts';
import { ruleOf, type LongPollBounds } from './rule.ts';
import type { AssertLongPollBounds } from './types.ts';

export const assertLongPollBounds: AssertLongPollBounds = function assertLongPollBounds(method, params) {
  const rule = ruleOf(method);
  const bounds = rule?.bounds;
  if (rule === undefined || bounds === undefined) {
    return;
  }
  const timeout = readPath(params, rule.timeoutPath);
  if (!isNumber(timeout) || isInside(timeout, bounds)) {
    return;
  }
  throw new HerdrTransportError(LongPollText.OutOfBounds(method, timeout, bounds.exclusiveMin, bounds.max));
};

// Strictly above exclusiveMin, at most max.
function isInside(value: number, bounds: LongPollBounds): boolean {
  return value > bounds.exclusiveMin && value <= bounds.max;
}
