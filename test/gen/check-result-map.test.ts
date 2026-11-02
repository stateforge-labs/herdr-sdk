// Role: tests the result-map checks (gen/check-result-map.ts) and the generator's refusal to emit from an incomplete map.
// Informs HERDR-ADR-0002 and plan section 4.2 (the generator fails on an unmapped method, a stale row, an unknown tag or a reasonless LOOSE row).
import { describe, expect, test } from 'bun:test';
import { checkResultMap, CHECK_MESSAGE } from '../../gen/check-result-map.ts';
import { renderOutputs } from '../../gen/index.ts';
import { METHOD_RESULT_MAP, RESULT_KIND, RESULT_SOURCE } from '../../gen/method-result-map.ts';
import type { ResultMap } from '../../gen/method-result-map.ts';
import { branchesOf, GEN_PATHS, loadSchema, requestNamespace } from '../../gen/schema.ts';
import type { ApiSchema } from '../../gen/schema.ts';

const EXTRA_METHOD = 'fake.extra';
const EXTRA_PARAMS_REF = '#/schemas/request/$defs/EmptyParams';

const committed = loadSchema(GEN_PATHS.schemaPath);

// The committed schema plus one request method that the map does not name; a copy, so the committed file is never touched.
function withExtraMethod(schema: ApiSchema): ApiSchema {
  const copy = structuredClone(schema);
  const request = requestNamespace(copy);
  const branch = {
    properties: { method: { const: EXTRA_METHOD, type: 'string' }, params: { $ref: EXTRA_PARAMS_REF } },
    required: ['method', 'params'],
    type: 'object',
  };
  request.oneOf = [...branchesOf(request), branch];
  return copy;
}

// The committed map with one row replaced or removed; a copy, so the real map is never touched.
function withRows(change: (map: Record<string, ResultMap[string]>) => void): ResultMap {
  const copy: Record<string, ResultMap[string]> = { ...METHOD_RESULT_MAP };
  change(copy);
  return copy;
}

describe('checkResultMap', () => {
  test('the committed map covers the committed schema exactly', () => {
    expect(checkResultMap(committed, METHOD_RESULT_MAP)).toEqual([]);
  });

  test('an unmapped method is a problem', () => {
    const problems = checkResultMap(committed, withRows((map) => { delete map.ping; }));
    expect(problems).toEqual([`ping ${CHECK_MESSAGE.unmapped}`]);
  });

  test('a row for a method the schema does not have is stale', () => {
    const map = withRows((rows) => { rows[EXTRA_METHOD] = { kind: RESULT_KIND.loose, reason: 'not in the schema' }; });
    expect(checkResultMap(committed, map)).toEqual([`${EXTRA_METHOD} ${CHECK_MESSAGE.stale}`]);
  });

  test('a typed row naming a tag the schema does not have is a problem', () => {
    const map = withRows((rows) => { rows.ping = { kind: RESULT_KIND.typed, tag: 'no_such_tag', source: RESULT_SOURCE.seed }; });
    expect(checkResultMap(committed, map)).toEqual([`ping ${CHECK_MESSAGE.unknownTag}: no_such_tag`]);
  });

  test('a LOOSE row without a reason is a problem', () => {
    const map = withRows((rows) => { rows.ping = { kind: RESULT_KIND.loose, reason: '   ' }; });
    expect(checkResultMap(committed, map)).toEqual([`ping ${CHECK_MESSAGE.reasonless}`]);
  });

  test('a LOOSE row with a reason passes', () => {
    const map = withRows((rows) => { rows.ping = { kind: RESULT_KIND.loose, reason: 'answers several tags' }; });
    expect(checkResultMap(committed, map)).toEqual([]);
  });

  test('a schema with an extra method is reported as unmapped', () => {
    expect(checkResultMap(withExtraMethod(committed), METHOD_RESULT_MAP)).toEqual([`${EXTRA_METHOD} ${CHECK_MESSAGE.unmapped}`]);
  });
});

describe('the generator refuses an incomplete map', () => {
  test('renderOutputs throws and names the unmapped method', () => {
    expect(() => renderOutputs(withExtraMethod(committed))).toThrow(EXTRA_METHOD);
  });

  test('renderOutputs on the committed schema does not throw', () => {
    expect(() => renderOutputs(committed)).not.toThrow();
  });
});
