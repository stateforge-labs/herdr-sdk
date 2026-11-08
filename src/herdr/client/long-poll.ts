// Role: long-poll methods: their bounds, the check of a requested timeout and the request timeout they need.
// Informs HERDR-ADR-0017, HERDR-ADR-0007, plan 3.6; merged by HERDR-ADR-0021 from types.ts, constants.ts, read-path.ts, rule.ts, bounds.ts, timeout.ts.
import { LONG_POLL } from '../generated/index.ts';
import type { Method } from '../generated/index.ts';
import { TypeofTag, Timeout } from '../../constants.ts';
import { HerdrTransportError } from '../errors.ts';

/** Methods whose rpc timeout follows a timeout_ms field in their params. */
export type LongPollMethod = keyof typeof LONG_POLL;

/**
 * The rpc timeout of one call: for a LongPollMethod whose timeout path is present, timeout_ms + Timeout.LongPollMarginMs;
 * otherwise `fallbackMs` (the client's timeoutMs). Pure. Implemented by client/long-poll/timeout.ts (P4a).
 * The namespace tree (P2b) calls it only for methods that are LONG_POLL keys.
 */
export type RequestTimeoutMs = (method: Method, params: unknown, fallbackMs: number | undefined) => number | undefined;

/**
 * Throws HerdrTransportError before sending when a bounded timeout is out of range (agent.start: > 3000 and <= 300000).
 * Pure. Implemented by client/long-poll/bounds.ts (P4a).
 */
export type AssertLongPollBounds = (method: Method, params: unknown) => void;

export const LongPollText = {
  OutOfBounds: (method: string, value: number, exclusiveMin: number, max: number): string =>
    `${method}: timeout_ms ${value} must be greater than ${exclusiveMin} and at most ${max}`,
} as const;

const ValueType = {
  Number: 'number',
} as const;

export function readPath(value: unknown, path: readonly string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

export function isNumber(value: unknown): value is number {
  return typeof value === ValueType.Number;
}

// A value the caller actually set: null and undefined both mean "not sent".
export function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === TypeofTag.Object && value !== null && !Array.isArray(value);
}

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
