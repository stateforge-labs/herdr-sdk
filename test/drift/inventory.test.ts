// Role: checks inventoryOf(): protocol, sorted facet names, the committed schema against the generated method table, and the typed error of a broken schema.
// Informs HERDR-ADR-0009 (drift compares the protocol and four facets by name) and plan 6; new test for lane P5c.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { METHOD_RESULT } from '../../src/herdr/generated/index.ts';
import { inventoryOf } from '../../src/drift/inventory.ts';
import { MalformedSchemaError } from '../../src/drift/malformed-schema-error.ts';
import { miniSchema } from './support/mini-schema.ts';
import { committedSchemaDocument } from './support/real-schema.ts';

const HERDR_VERSION = '0.9.5';
const COMMITTED_METHOD_COUNT = 102;

describe('inventoryOf', () => {
  // The committed protocol-22 schema has 102 request methods; METHOD_RESULT is a 25-row seed until P3 completes it.
  test('reads the committed schema: protocol 22, 102 methods, every seeded method among them', () => {
    const inventory = inventoryOf(committedSchemaDocument(), HERDR_VERSION);
    assert.equal(inventory.protocol, 22);
    assert.equal(inventory.herdrVersion, HERDR_VERSION);
    assert.equal(inventory.methods.length, COMMITTED_METHOD_COUNT);
    assert.ok(Object.keys(METHOD_RESULT).every((method) => inventory.methods.includes(method)));
    assert.deepEqual(inventory.methods, inventory.methods.toSorted());
  });

  test('sorts every facet by name', () => {
    const inventory = inventoryOf(miniSchema({ methods: ['workspace.list', 'ping'] }), HERDR_VERSION);
    assert.deepEqual(inventory.methods, ['ping', 'workspace.list']);
    assert.deepEqual(inventory.resultTags, ['pong', 'workspace_list']);
    assert.deepEqual(inventory.eventKinds, ['workspace_created']);
    assert.deepEqual(inventory.subscriptionTypes, ['pane.output_matched', 'workspace.created']);
  });

  test('names a missing ResponseResult as malformed', () => {
    const broken = JSON.parse(JSON.stringify(miniSchema())) as { schemas: { success_response: { $defs: Record<string, unknown> } } };
    delete broken.schemas.success_response.$defs.ResponseResult;
    assert.throws(() => inventoryOf(broken as never, HERDR_VERSION), MalformedSchemaError);
  });

  test('gives each params and result definition a field shape', () => {
    const inventory = inventoryOf(miniSchema(), HERDR_VERSION);
    assert.ok(Object.hasOwn(inventory.fieldShapes, 'request.Params'));
    assert.ok(Object.hasOwn(inventory.fieldShapes, 'success_response.Result'));
  });
});
