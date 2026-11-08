// Role: tests the complete method -> result map (tools/gen/method-result-map.ts): its rows, sources and the typed-only projection the generator emits.
// Informs HERDR-ADR-0002 and plan section 4.2 (one row per request method; a typed row names its source; a LOOSE row carries a reason).
import { describe, expect, test } from 'bun:test';
import { isLoose, methodResultTags, METHOD_RESULT_MAP, RESULT_KIND, RESULT_SOURCE } from '../../../tools/gen/method-result-map.ts';

const rows = Object.entries(METHOD_RESULT_MAP);
const SOURCE_VALUES: ReadonlySet<string> = new Set(Object.values(RESULT_SOURCE));

describe('the complete map', () => {
  test('there is one row per request method of the committed schema', () => {
    expect(rows.length).toBe(102);
  });

  test('every typed row names a source from RESULT_SOURCE', () => {
    for (const [, row] of rows) {
      if (row.kind === RESULT_KIND.typed) {
        expect(SOURCE_VALUES.has(row.source)).toBe(true);
      }
    }
  });

  test('every LOOSE row carries a non-empty reason', () => {
    for (const [, row] of rows) {
      if (isLoose(row)) {
        expect(row.kind === RESULT_KIND.loose && row.reason.trim().length > 0).toBe(true);
      }
    }
  });
});

describe('methodResultTags', () => {
  test('is the typed rows only, as method -> tag', () => {
    const tags = methodResultTags();
    for (const [method, row] of rows) {
      expect(tags[method]).toBe(row.kind === RESULT_KIND.typed ? row.tag : undefined);
    }
  });
});
