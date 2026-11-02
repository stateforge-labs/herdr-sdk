// Role: checks stableText(): the schema keyword `description` is dropped at any schema level, while a name in a `properties` or `$defs` map is kept.
// Informs HERDR-ADR-0009 (drift reports a changed field shape; a wording change is not drift); new test for lane P5c.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { stableText } from '../../src/drift/stable-text.ts';

describe('stableText', () => {
  test('the schema keyword description is not part of the shape', () => {
    assert.equal(
      stableText({ type: 'string', description: 'first wording' }),
      stableText({ type: 'string', description: 'second wording' }),
    );
    assert.equal(stableText({ type: 'string', description: 'x' }), stableText({ type: 'string' }));
  });

  test('a property named description is kept, so its type is part of the shape', () => {
    const string = stableText({ properties: { description: { type: 'string' } } });
    const integer = stableText({ properties: { description: { type: 'integer' } } });
    assert.notEqual(string, integer);
    assert.ok(string.includes('"description"'), string);
  });

  test('a definition named description is kept', () => {
    assert.ok(stableText({ $defs: { description: { type: 'string' } } }).includes('"description"'));
  });

  test('keys are sorted, so the same shape gives the same text', () => {
    assert.equal(stableText({ b: 1, a: { d: 2, c: 3 } }), stableText({ a: { c: 3, d: 2 }, b: 1 }));
  });
});
