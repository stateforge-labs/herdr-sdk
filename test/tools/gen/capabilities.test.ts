// Role: tests of the hand-kept capability table (tools/gen/capabilities.ts) against the committed schema.
// Informs HERDR-ADR-0005 and plan section 4: every method classed once, class counts fixed, entry sets respect the class rules.
import { describe, expect, test } from 'bun:test';
import { ENTRY_CLASSES, EntryKey, METHOD_CLASS, PRESETS, assertClassified, classOf, CapabilityClass } from '../../../tools/gen/capabilities.ts';
import { methodNames } from '../../../tools/gen/emit-method-table.ts';
import { GEN_PATHS, loadSchema } from '../../../tools/gen/schema.ts';

const EXPECTED_METHOD_COUNT = 102;
const EXPECTED_COUNTS: Readonly<Record<string, number>> = {
  'R-meta': 24, 'R-content': 3, 'W': 34, 'I': 6, 'H': 6, 'L': 4, 'C': 4, 'X': 9, 'D': 8, 'S': 4,
};

const committedMethods = methodNames(loadSchema(GEN_PATHS.schemaPath));

function countsByClass(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of Object.values(METHOD_CLASS)) {
    counts[row.class] = (counts[row.class] ?? 0) + 1;
  }
  return counts;
}

describe('capability table', () => {
  test('classifies all 102 methods, the same set as the schema', () => {
    expect(Object.keys(METHOD_CLASS).length).toBe(EXPECTED_METHOD_COUNT);
    expect([...Object.keys(METHOD_CLASS)].sort()).toEqual([...committedMethods].sort());
    expect(() => assertClassified(committedMethods)).not.toThrow();
  });

  test('class counts match the spec', () => {
    expect(countsByClass()).toEqual(EXPECTED_COUNTS);
  });

  test('the class names are the ones in CapabilityClass', () => {
    const allowed = new Set<string>(Object.values(CapabilityClass));
    for (const row of Object.values(METHOD_CLASS)) {
      expect(allowed.has(row.class)).toBe(true);
    }
  });

  test('a method with no row is refused', () => {
    expect(() => assertClassified([...committedMethods, 'no.such.method'])).toThrow("unclassified method 'no.such.method'");
  });

  test('a row for a method the schema lacks is refused as stale', () => {
    const withoutFirst = committedMethods.slice(1);
    expect(() => assertClassified(withoutFirst)).toThrow(`stale class row '${committedMethods[0]}'`);
  });

  test('classOf refuses an unknown method', () => {
    expect(() => classOf('no.such.method')).toThrow("unclassified method 'no.such.method'");
  });
});

describe('entry point class sets', () => {
  const nonHeld = Object.entries(ENTRY_CLASSES).filter(([key]) => key !== EntryKey.Held);

  test('no C method appears in any non-held entry', () => {
    for (const [, classes] of nonHeld) {
      expect(classes).not.toContain(CapabilityClass.C);
    }
  });

  test('D, S and X appear only in the admin entry', () => {
    for (const [key, classes] of Object.entries(ENTRY_CLASSES)) {
      const dangerous = classes.some((cls) => cls === CapabilityClass.D || cls === CapabilityClass.S || cls === CapabilityClass.X);
      expect(dangerous).toBe(key === EntryKey.Admin);
    }
  });

  test('the SessionsReader preset is inside the readOnly entry', () => {
    const readOnly = new Set(ENTRY_CLASSES.readOnly);
    for (const method of PRESETS.SessionsReader) {
      expect(readOnly.has(classOf(method))).toBe(true);
    }
  });
});
