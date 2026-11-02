// Role: reads a path out of an unknown params value (the timeout_ms of a long-poll call); a missing or non-object step reads as undefined.
// Informs HERDR-ADR-0007 and plan 3.6; lane-internal to P4a, shared by timeout.ts and bounds.ts.
import { TypeofTag } from '../../constants.ts';

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
