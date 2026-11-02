// Role: tests of the default instance generator (gen/emit-defaults.ts) over the committed schema and the recursive and nullable fixtures.
// Informs HERDR-ADR-0008 and plan section 3.2 (one schema-valid default per response tag).
import { describe, expect, test } from 'bun:test';
import { DEFAULT_RESULT, ResultTag } from '../../src/generated/index.ts';
import { defaultsByTag, instanceOf } from '../../gen/emit-defaults.ts';
import type { JsonValue } from '../../gen/emit-defaults.ts';
import { GEN_PATHS, loadSchema } from '../../gen/schema.ts';
import type { JSONSchema } from '../../gen/schema.ts';
import { ApiSchemaFixture } from './fixture-paths.ts';

const EXPECTED_TAG_COUNT = 63;

const committed = loadSchema(GEN_PATHS.schemaPath);

describe('committed defaults', () => {
  test('one default per response tag', () => {
    expect(Object.keys(defaultsByTag(committed)).length).toBe(EXPECTED_TAG_COUNT);
    expect(Object.keys(DEFAULT_RESULT).length).toBe(EXPECTED_TAG_COUNT);
    expect(Object.keys(DEFAULT_RESULT).sort()).toEqual([...Object.values(ResultTag)].sort());
  });

  test('each default carries its own tag in its type field', () => {
    for (const tag of Object.keys(DEFAULT_RESULT)) {
      const value = DEFAULT_RESULT[tag as keyof typeof DEFAULT_RESULT] as { readonly type?: unknown };
      expect(value.type).toBe(tag);
    }
  });

  test('objects hold only their required keys', () => {
    const pong = DEFAULT_RESULT.pong;
    expect(Object.keys(pong).sort()).toEqual([...(committed.schemas.success_response?.$defs?.ResponseResult?.oneOf ?? [])
      .find((branch) => branch.properties?.type?.const === 'pong')?.required ?? []].sort());
  });
});

describe('fixture schemas', () => {
  const recursive = loadSchema(ApiSchemaFixture.recursiveLayout);
  const nullable = loadSchema(ApiSchemaFixture.nullable);

  test('a recursive LayoutNode terminates on the pane branch', () => {
    const layout: JSONSchema = { $ref: '#/schemas/request/$defs/LayoutNode' };
    expect(instanceOf(recursive, layout)).toEqual({ type: 'pane' });
  });

  test('a nullable type array gives null', () => {
    expect(instanceOf(nullable, { type: ['integer', 'null'] })).toBeNull();
  });

  test('a uint64 integer gives 0 and a required-only object keeps only count', () => {
    const probe: JSONSchema = { $ref: '#/schemas/request/$defs/NullableProbe' };
    const value: JsonValue | undefined = instanceOf(nullable, probe);
    expect(value).toEqual({ count: null });
  });

  test('a string with a pattern gets the placeholder', () => {
    const value = instanceOf(nullable, { type: 'string', pattern: '^x$' });
    expect(value).toBe('default');
  });
});
