// Role: tests nullable types, uint64 and default notes, and doc-comment escaping through the params emitter.
// Informs HERDR-ADR-0002 and plan section 3.2 (nullable type arrays, uint64 as number with a doc note, default as a doc note).
import { describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitParams } from '../../gen/emit-params.ts';
import { loadSchema } from '../../gen/schema.ts';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(TEST_DIR, 'fixtures', 'nullable.schema.json');
const HEADER = '';

const UINT64_NOTE = 'uint64: values above 2^53 lose precision';
const ESCAPED_DESCRIPTION = 'Ends a comment * / early.';

describe('nullable types', () => {
  const output = emitParams(loadSchema(FIXTURE_PATH), HEADER);

  test('a nullable integer type array becomes number or null', () => {
    expect(output).toContain('"count": number | null;');
  });

  test('a nullable reference via oneOf keeps each member in parentheses', () => {
    expect(output).toContain('"parent"?: (Parent) | (null);');
  });
});

describe('field notes', () => {
  const output = emitParams(loadSchema(FIXTURE_PATH), HEADER);

  test('uint64 gets the precision note', () => {
    expect(output).toContain(`/** ${UINT64_NOTE} */ "seq"?: number;`);
  });

  test('a default becomes an @default note', () => {
    expect(output).toContain('/** @default 3 */ "retries"?: number;');
  });

  test('a comment terminator inside a description is escaped', () => {
    expect(output).toContain(`/** ${ESCAPED_DESCRIPTION} */ "note"?: string;`);
    expect(output).not.toContain('Ends a comment */');
  });
});
