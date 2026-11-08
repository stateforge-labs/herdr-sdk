// Role: tests of the definition merger (tools/gen/merge-defs.ts): ref normalisation, structural equality, first-wins and conflicts.
// Informs HERDR-ADR-0002 and plan section 3.2 (repeated definitions across bundles).
import { describe, expect, test } from 'bun:test';
import { mergeDefinitions, normaliseRefs, structurallyEqual } from '../../../tools/gen/merge-defs.ts';
import type { JSONSchema } from '../../../tools/gen/schema.ts';

const BUNDLE = { event: 'event', subscription: 'subscription_event' } as const;
const DEF = { status: 'AgentStatus', other: 'PaneScrollInfo' } as const;
const CONFLICT_PREFIX = "conflicting definition 'AgentStatus' in bundles event and subscription_event";

const statusEnum: JSONSchema = { enum: ['idle', 'working'], type: 'string' };
const statusEnumOtherKeyOrder: JSONSchema = { type: 'string', enum: ['idle', 'working'] };
const statusEnumDifferent: JSONSchema = { enum: ['idle', 'done'], type: 'string' };

describe('normaliseRefs', () => {
  test('reduces every $ref to the bare definition name, at any depth', () => {
    const input = {
      properties: {
        status: { $ref: '#/schemas/event/$defs/AgentStatus' },
        list: { items: { $ref: '#/schemas/event/$defs/PaneInfo' } },
      },
    };
    expect(normaliseRefs(input)).toEqual({
      properties: {
        status: { $ref: 'AgentStatus' },
        list: { items: { $ref: 'PaneInfo' } },
      },
    });
  });

  test('leaves values that are not refs unchanged', () => {
    expect(normaliseRefs({ const: 'ping', type: 'string' })).toEqual({ const: 'ping', type: 'string' });
  });
});

describe('structurallyEqual', () => {
  test('ignores the bundle prefix of a $ref', () => {
    const fromEvent: JSONSchema = { properties: { s: { $ref: '#/schemas/event/$defs/AgentStatus' } } };
    const fromSubscription: JSONSchema = {
      properties: { s: { $ref: '#/schemas/subscription_event/$defs/AgentStatus' } },
    };
    expect(structurallyEqual(fromEvent, fromSubscription)).toBe(true);
  });

  test('ignores the order in which keys were written', () => {
    expect(structurallyEqual(statusEnum, statusEnumOtherKeyOrder)).toBe(true);
  });

  test('tells apart definitions whose content differs', () => {
    expect(structurallyEqual(statusEnum, statusEnumDifferent)).toBe(false);
  });
});

describe('mergeDefinitions', () => {
  test('keeps the first occurrence when a later one is structurally equal', () => {
    const first = { [DEF.status]: statusEnum };
    const second = { [DEF.status]: statusEnumOtherKeyOrder };
    const merged = mergeDefinitions([
      { name: BUNDLE.event, defs: first },
      { name: BUNDLE.subscription, defs: second },
    ]);
    expect(merged[DEF.status]).toBe(statusEnum);
    expect(Object.keys(merged)).toEqual([DEF.status]);
  });

  test('keeps names from every bundle', () => {
    const merged = mergeDefinitions([
      { name: BUNDLE.event, defs: { [DEF.status]: statusEnum } },
      { name: BUNDLE.subscription, defs: { [DEF.other]: { type: 'object' } } },
    ]);
    expect(Object.keys(merged)).toEqual([DEF.status, DEF.other]);
  });

  test('refuses a different definition under the same name, naming both bundles', () => {
    expect(() => mergeDefinitions([
      { name: BUNDLE.event, defs: { [DEF.status]: statusEnum } },
      { name: BUNDLE.subscription, defs: { [DEF.status]: statusEnumDifferent } },
    ])).toThrow(CONFLICT_PREFIX);
  });
});
