// Role: tests of the params shape table (gen/emit-shapes.ts) and its runtime copy in src/generated/shapes.ts.
// Informs HERDR-ADR-0008 and plan sections 3.2 and 5 (required keys, enums, tokens key pattern).
import { describe, expect, test } from 'bun:test';
import { PARAMS_SHAPE, TOKEN_NAME_PATTERN } from '../../src/generated/index.ts';
import { paramsShapeOf } from '../../gen/emit-shapes.ts';
import { methodNames } from '../../gen/emit-method-table.ts';
import { GEN_PATHS, loadSchema } from '../../gen/schema.ts';
import { ApiSchemaFixture } from './fixture-paths.ts';

const schema = loadSchema(GEN_PATHS.schemaPath);
const EXPECTED_METHOD_COUNT = 102;

describe('params shape table', () => {
  test('one entry per method', () => {
    expect(Object.keys(PARAMS_SHAPE).length).toBe(EXPECTED_METHOD_COUNT);
    expect(Object.keys(PARAMS_SHAPE).sort()).toEqual([...methodNames(schema)].sort());
  });

  test('agent.read requires source and target and takes the format enum', () => {
    const shape = PARAMS_SHAPE['agent.read'];
    expect([...shape.required].sort()).toEqual(['source', 'target']);
    expect(shape.fields.format?.enum).toEqual(['text', 'ansi']);
    expect(shape.fields.format?.kinds).toEqual(['string']);
  });

  test('a tokens map carries the shared key pattern', () => {
    expect(PARAMS_SHAPE['pane.report_metadata'].fields.tokens?.keyPattern).toBe(TOKEN_NAME_PATTERN);
  });

  test('the generator builds the same shape the committed table holds', () => {
    expect(paramsShapeOf(schema, 'agent.read')).toEqual(PARAMS_SHAPE['agent.read']);
  });

  test('two methods that share one params type get the same shape', () => {
    const shared = loadSchema(ApiSchemaFixture.sharedParams);
    expect(paramsShapeOf(shared, 'pane.get')).toEqual(paramsShapeOf(shared, 'pane.focus'));
  });
});
