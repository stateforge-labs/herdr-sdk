// Role: checks nameDiff(): added and removed names, each sorted, and hasMovement().
// Informs HERDR-ADR-0009 (added and removed are listed separately); new test for lane P5c.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { hasMovement, nameDiff } from '../../src/drift/diff.ts';

describe('nameDiff', () => {
  test('lists names only the installed side has as added, sorted', () => {
    assert.deepEqual(nameDiff(['ping'], ['ping', 'zeta', 'alpha']), { added: ['alpha', 'zeta'], removed: [] });
  });

  test('lists names only the committed side has as removed, sorted', () => {
    assert.deepEqual(nameDiff(['zeta', 'ping', 'alpha'], ['ping']), { added: [], removed: ['alpha', 'zeta'] });
  });

  test('reports nothing for equal lists in any order', () => {
    const diff = nameDiff(['b', 'a'], ['a', 'b']);
    assert.deepEqual(diff, { added: [], removed: [] });
    assert.equal(hasMovement(diff), false);
  });

  test('hasMovement is true when either side moved', () => {
    assert.equal(hasMovement({ added: ['x'], removed: [] }), true);
    assert.equal(hasMovement({ added: [], removed: ['x'] }), true);
  });
});
