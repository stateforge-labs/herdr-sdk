// Role: checks driftBetween(): identity, each facet alone, protocol and herdr version moves, a narrowed field, and an unmapped method.
// Informs HERDR-ADR-0009 (drift is protocol, version, four facets, field shapes and unmapped methods) and plan 6; new test for lane P5c.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { driftBetween } from '../../src/drift/drift-between.ts';
import { inventoryOf } from '../../src/drift/inventory.ts';
import { METHOD_RESULT } from '../../src/generated/index.ts';
import type { DriftReport, SchemaDocument } from '../../src/drift/types.ts';
import { miniSchema } from './support/mini-schema.ts';
import { committedSchemaDocument } from './support/real-schema.ts';

const VERSION = '0.9.5';

// The committed schema lists 102 methods and METHOD_RESULT maps 25 of them (77 unmapped). P3 regenerates the table and this pin changes with it.
const KNOWN_UNMAPPED_METHODS = 55;

// A copy of the mini schema whose Params property `description` has the given type (a property named like the schema keyword).
function withDescriptionProperty(type: string): SchemaDocument {
  const schema = JSON.parse(JSON.stringify(miniSchema())) as { schemas: { request: { $defs: { Params: { properties: Record<string, unknown> } } } } };
  schema.schemas.request.$defs.Params.properties.description = { type };
  return schema as SchemaDocument;
}

function between(committed: SchemaDocument, installed: SchemaDocument, installedVersion = VERSION): DriftReport {
  return driftBetween(
    { schema: committed, herdrVersion: VERSION },
    { schema: installed, herdrVersion: installedVersion },
  );
}

describe('driftBetween', () => {
  test('identical schemas are clean with every diff empty', () => {
    const report = between(miniSchema(), miniSchema());
    assert.equal(report.drifted, false);
    for (const diff of [report.methods, report.resultTags, report.eventKinds, report.subscriptionTypes]) {
      assert.deepEqual(diff, { added: [], removed: [] });
    }
    assert.deepEqual(report.changedShapes, []);
    assert.deepEqual(report.unmappedMethods, []);
  });

  // The committed schema against itself: every facet is equal. Methods without a METHOD_RESULT row are the known gap until P3 regenerates the table (plan 4.2).
  test('the committed schema matches itself, and its only finding is the known METHOD_RESULT gap', () => {
    const report = between(committedSchemaDocument(), committedSchemaDocument());
    assert.equal(report.unmappedMethods.length, KNOWN_UNMAPPED_METHODS);
    assert.equal(report.drifted, true);
    for (const diff of [report.methods, report.resultTags, report.eventKinds, report.subscriptionTypes]) {
      assert.deepEqual(diff, { added: [], removed: [] });
    }
    assert.deepEqual(report.changedShapes, []);
  });

  test('a method added on the installed side is named as added and drifts', () => {
    const report = between(miniSchema(), miniSchema({ methods: ['ping', 'workspace.list', 'pane.new'] }));
    assert.deepEqual(report.methods, { added: ['pane.new'], removed: [] });
    assert.equal(report.drifted, true);
  });

  test('a method removed on the installed side is named as removed and drifts', () => {
    const report = between(miniSchema(), miniSchema({ methods: ['ping'] }));
    assert.deepEqual(report.methods, { added: [], removed: ['workspace.list'] });
    assert.equal(report.drifted, true);
  });

  test('a result tag, an event kind and a subscription type each move on their own facet', () => {
    assert.deepEqual(between(miniSchema(), miniSchema({ results: ['pong', 'workspace_list', 'new_result'] })).resultTags,
      { added: ['new_result'], removed: [] });
    assert.deepEqual(between(miniSchema(), miniSchema({ events: [] })).eventKinds,
      { added: [], removed: ['workspace_created'] });
    assert.deepEqual(between(miniSchema(), miniSchema({ subscriptions: ['workspace.created'] })).subscriptionTypes,
      { added: [], removed: ['pane.output_matched'] });
  });

  test('a protocol move drifts and is reported', () => {
    const report = between(miniSchema(), miniSchema({ protocol: 23 }));
    assert.deepEqual(report.protocol, { committed: 22, installed: 23 });
    assert.equal(report.drifted, true);
  });

  test('a herdr version move alone drifts', () => {
    const report = between(miniSchema(), miniSchema(), '0.9.6');
    assert.deepEqual(report.herdrVersion, { committed: '0.9.5', installed: '0.9.6' });
    assert.equal(report.drifted, true);
  });

  test('a narrowed field shape is a changed shape', () => {
    const report = between(miniSchema(), miniSchema({ limitType: 'string' }));
    assert.deepEqual(report.changedShapes, ['request.Params']);
    assert.equal(report.drifted, true);
  });

  test('a property named description that is retyped is a changed shape', () => {
    const report = between(withDescriptionProperty('string'), withDescriptionProperty('integer'));
    assert.deepEqual(report.changedShapes, ['request.Params']);
    assert.equal(report.drifted, true);
  });

  test('a property named description that is removed is a changed shape', () => {
    const report = between(withDescriptionProperty('string'), miniSchema());
    assert.deepEqual(report.changedShapes, ['request.Params']);
  });

  test('an installed method without a METHOD_RESULT row is unmapped', () => {
    const report = between(miniSchema(), miniSchema({ methods: ['ping', 'workspace.list', 'fake.method'] }));
    assert.deepEqual(report.unmappedMethods, ['fake.method']);
    assert.equal(report.drifted, true);
  });
});
