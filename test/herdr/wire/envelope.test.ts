// Role: checks the envelope helpers: error-envelope detection, the object check and the request encoding (one JSON line, no newline).
// Informs HERDR-ADR-0016 (W3 error envelope) and plan 3.1; ported-and-extended from atalaya src/protocol/envelope.ts.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isErrorEnvelope, isObject, encodeRequest } from '../../../src/herdr/wire/codec.ts';

describe('isErrorEnvelope', () => {
  test('is true for an envelope with an error field', () => {
    assert.equal(isErrorEnvelope({ id: 'x', error: { code: 'c', message: 'm' } }), true);
  });

  test('is false for a success envelope', () => {
    assert.equal(isErrorEnvelope({ id: 'x', result: { type: 'ok' } }), false);
  });
});

describe('isObject', () => {
  test('accepts a plain object', () => {
    assert.equal(isObject({ id: 'x' }), true);
  });

  test('rejects null, arrays, strings and numbers', () => {
    assert.equal(isObject(null), false);
    assert.equal(isObject([1]), false);
    assert.equal(isObject('text'), false);
    assert.equal(isObject(7), false);
  });
});

describe('encodeRequest', () => {
  test('writes id, method and params as one JSON object without a newline', () => {
    const line = encodeRequest('sdk-1-abc', 'ping', {});
    assert.equal(line.includes('\n'), false);
    assert.deepEqual(JSON.parse(line), { id: 'sdk-1-abc', method: 'ping', params: {} });
  });
});
