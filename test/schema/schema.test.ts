// Role: the /schema entry read from source: a non-empty method table with the read-only R-meta members, and a parameter shape for a named method.
// Informs plan 10.1 (size table: the schema row is measured only) and the package exports of HERDR-ADR-0012.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityClass, METHODS, PARAMS_SHAPE } from '../../src/schema.ts';

describe('/schema entry', () => {
  test('METHODS is non-empty and its read-only (R-meta) members include workspace.list and session.snapshot', () => {
    assert.ok(METHODS.length > 0);
    const readOnlyNames = METHODS.filter((method) => method.class === CapabilityClass.RMeta).map((method) => method.name);
    assert.ok(readOnlyNames.includes('workspace.list'));
    assert.ok(readOnlyNames.includes('session.snapshot'));
  });

  test('PARAMS_SHAPE has an entry for workspace.get', () => {
    assert.ok(Object.hasOwn(PARAMS_SHAPE, 'workspace.get'));
  });
});
