// Role: checks the value constructors ./core exports for branded values: brand, ok, err, isFields and the Result guards, through the entry file.
// Informs HERDR-ADR-0020 (the herdr-core client) and the rule that a consumer's branded values share the SDK's brand marker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brand, err, isErr, isFields, isOk, ok } from '../../src/core.ts';

test('ok and err build the Result shapes of kernel.ts', () => {
  assert.deepEqual(ok(1), { kind: 'ok', value: 1 });
  assert.deepEqual(err('x'), { kind: 'err', error: 'x' });
});

test('isOk and isErr narrow the results built by ok and err', () => {
  assert.equal(isOk(ok(1)), true);
  assert.equal(isErr(ok(1)), false);
  assert.equal(isErr(err(1)), true);
  assert.equal(isOk(err(1)), false);
});

test('brand is an identity cast at runtime', () => {
  assert.equal(brand<string, 'PaneId'>('t1'), 't1');
});

test('isFields accepts a plain object and refuses null and strings', () => {
  assert.equal(isFields({ a: 1 }), true);
  assert.equal(isFields(null), false);
  assert.equal(isFields('x'), false);
});
