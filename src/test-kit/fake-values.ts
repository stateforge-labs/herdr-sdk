// Role: reads one field of a parsed JSON value and tells a string apart, without casts.
// Informs HERDR-ADR-0016 (the wire is JSON; a value the fake reads may be of any kind) and plan 5; test-kit only.
import { TypeofTag } from '../constants.ts';
import { isObject } from '../wire/envelope.ts';

// The field of a JSON object, or undefined when the value is not an object. JSON has no undefined, so undefined means absent.
export function fieldOf(value: unknown, name: string): unknown {
  return isObject(value) ? Reflect.get(value, name) : undefined;
}

// True for a string value.
export function isText(value: unknown): value is string {
  return typeof value === TypeofTag.String;
}
