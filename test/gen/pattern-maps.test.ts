// Role: tests additionalProperties maps with propertyNames patterns, and plain maps, through the params emitter.
// Informs HERDR-ADR-0002 and plan section 3.2 (20 additionalProperties maps; the key pattern is a doc note, not a type).
import { describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitParams } from '../../gen/emit-params.ts';
import { loadSchema } from '../../gen/schema.ts';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(TEST_DIR, 'fixtures', 'pattern-maps.schema.json');
const HEADER = '';

const KEY_PATTERN = '^[A-Za-z0-9_-]{1,32}$';
const KEYS_MATCH_NOTE = `keys match ${KEY_PATTERN}`;

describe('maps with a propertyNames pattern', () => {
  const output = emitParams(loadSchema(FIXTURE_PATH), HEADER);

  test('a string-valued map is an index signature', () => {
    expect(output).toContain('"tokens"?: { [key: string]: string; };');
  });

  test('a nullable-valued map is an index signature of string or null', () => {
    expect(output).toContain('"nullable_tokens"?: { [key: string]: string | null; };');
  });

  test('the key pattern is documented on the field that holds the map', () => {
    expect(output).toContain(`/** ${KEYS_MATCH_NOTE} */ "tokens"?:`);
    expect(output).toContain(`/** ${KEYS_MATCH_NOTE} */ "nullable_tokens"?:`);
  });
});

describe('a plain map without a key pattern', () => {
  const output = emitParams(loadSchema(FIXTURE_PATH), HEADER);

  test('is an index signature', () => {
    expect(output).toContain('"plain"?: { [key: string]: string; };');
  });

  test('has no key-pattern note', () => {
    expect(output).not.toContain(`${KEY_PATTERN} */ "plain"`);
  });
});
