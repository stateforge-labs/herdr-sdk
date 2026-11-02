// Role: tests the hand-kept method -> result seed (gen/method-result-map.ts) against the committed schema.
// Informs HERDR-ADR-0002 and plan section 4.2 (25 seed rows; every method and every tag must exist in the schema).
import { describe, expect, test } from 'bun:test';
import { branchesOf, constOf, definitionsOf, GEN_PATHS, loadSchema, namespaceOf, requestNamespace, SCHEMA_KEY, SCHEMA_NAMESPACE } from '../../gen/schema.ts';
import { METHOD_RESULT_SEED, RESULT_SOURCE } from '../../gen/method-result-map.ts';

const SEED_ROW_COUNT = 25;
const RESPONSE_RESULT = 'ResponseResult';

const committed = loadSchema(GEN_PATHS.schemaPath);

describe('the seed rows', () => {
  const rows = Object.entries(METHOD_RESULT_SEED);

  test('there are 25 rows, all named by the seed source', () => {
    expect(rows.length).toBe(SEED_ROW_COUNT);
    for (const [, row] of rows) {
      expect(row.source).toBe(RESULT_SOURCE.seed);
    }
  });

  test('every method is a request method of the committed schema', () => {
    const methods = new Set(branchesOf(requestNamespace(committed)).map((branch) => constOf(branch, SCHEMA_KEY.method)));
    for (const [method] of rows) {
      expect(methods.has(method)).toBe(true);
    }
  });

  test('every tag is a ResponseResult tag of the committed schema', () => {
    const responseResult = definitionsOf(namespaceOf(committed, SCHEMA_NAMESPACE.successResponse))[RESPONSE_RESULT];
    const tags = new Set(branchesOf(responseResult ?? {}).map((branch) => constOf(branch, SCHEMA_KEY.type)));
    for (const [, row] of rows) {
      expect(tags.has(row.tag)).toBe(true);
    }
  });
});
