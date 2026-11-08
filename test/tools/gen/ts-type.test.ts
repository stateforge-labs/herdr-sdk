// Role: tests of the JSON Schema to TypeScript mapping (tools/gen/ts-type.ts) for each JSON type and composition keyword.
// Informs HERDR-ADR-0002 and plan section 3.2 (ported ts-type.ts; comparisons go through JSON_TYPE).
import { describe, expect, test } from 'bun:test';
import { JSON_TYPE } from '../../../tools/gen/json-type.ts';
import { refName, tsType } from '../../../tools/gen/ts-type.ts';

const REF = '#/schemas/request/$defs/PaneTarget';

describe('scalar JSON types', () => {
  test('string', () => {
    expect(tsType({ type: JSON_TYPE.string })).toBe('string');
  });

  test('integer and number both become number', () => {
    expect(tsType({ type: JSON_TYPE.integer })).toBe('number');
    expect(tsType({ type: JSON_TYPE.number })).toBe('number');
  });

  test('boolean', () => {
    expect(tsType({ type: JSON_TYPE.boolean })).toBe('boolean');
  });

  test('null', () => {
    expect(tsType({ type: JSON_TYPE.null })).toBe('null');
  });

  test('array of items', () => {
    expect(tsType({ type: JSON_TYPE.array, items: { type: JSON_TYPE.string } })).toBe('Array<string>');
  });

  test('array without items has unknown elements', () => {
    expect(tsType({ type: JSON_TYPE.array })).toBe('Array<unknown>');
  });

  test('an object with no properties is an empty record', () => {
    expect(tsType({ type: JSON_TYPE.object })).toBe('Record<string, never>');
  });
});

describe('nullable type arrays', () => {
  test('integer or null becomes number or null', () => {
    expect(tsType({ type: [JSON_TYPE.integer, JSON_TYPE.null] })).toBe('number | null');
  });
});

describe('composition keywords', () => {
  test('const is the JSON literal', () => {
    expect(tsType({ const: 'pong' })).toBe('"pong"');
  });

  test('enum is a union of JSON literals', () => {
    expect(tsType({ enum: ['a', 'b'] })).toBe('"a" | "b"');
  });

  test('anyOf is a union with each member in parentheses', () => {
    expect(tsType({ anyOf: [{ type: JSON_TYPE.string }, { type: JSON_TYPE.null }] })).toBe('(string) | (null)');
  });

  test('allOf is an intersection', () => {
    expect(tsType({ allOf: [{ $ref: REF }, { type: JSON_TYPE.object }] })).toBe('(PaneTarget) & (Record<string, never>)');
  });

  test('a $ref becomes the bare definition name', () => {
    expect(tsType({ $ref: REF })).toBe('PaneTarget');
  });
});

describe('refName', () => {
  test('keeps the last path segment', () => {
    expect(refName(REF)).toBe('PaneTarget');
  });
});
