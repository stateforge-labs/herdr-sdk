// Role: the rpc timeout of one call: a long-poll method whose timeout_ms is set waits timeout_ms plus the margin; anything else uses the client's timeout.
// Informs HERDR-ADR-0007 and plan 3.6 (Timeout.LongPollMarginMs); contract in client/long-poll/types.ts (RequestTimeoutMs).
import { Timeout } from '../../../constants.ts';
import { isNumber, isPresent, readPath } from './read-path.ts';
import { ruleOf, type LongPollRule } from './rule.ts';
import type { RequestTimeoutMs } from './types.ts';

export const requestTimeoutMs: RequestTimeoutMs = function requestTimeoutMs(method, params, fallbackMs) {
  const rule = ruleOf(method);
  if (rule === undefined || !isGateOpen(rule, params)) {
    return fallbackMs;
  }
  const timeout = readPath(params, rule.timeoutPath);
  return isNumber(timeout) ? timeout + Timeout.LongPollMarginMs : fallbackMs;
};

// agent.prompt only waits when `wait` is sent; without it the call is an ordinary request.
function isGateOpen(rule: LongPollRule, params: unknown): boolean {
  const gate = rule.onlyWhenPresent;
  return gate === undefined || isPresent(readPath(params, [gate]));
}
