// Role: checks bearerGuard: the Bearer scheme, constant-time token comparison, and false (never a throw) for every malformed header.
// Informs HERDR-ADR-0010 and plan 7 (lane P6c). Pure: no socket, no fake, no real token (the token is a test value).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { bearerGuard } from '../../src/mcp/bearer-guard.ts';

const EXPECTED = 'a'.repeat(64);
const WRONG_SAME_LENGTH = 'b'.repeat(64);
const SCHEME_PREFIX = 'Bearer ';

const guard = bearerGuard(EXPECTED);

describe('bearerGuard', () => {
  test('accepts the correct token after the Bearer scheme', () => {
    assert.equal(guard(SCHEME_PREFIX + EXPECTED), true);
  });

  test('rejects a wrong token of the same length', () => {
    assert.equal(guard(SCHEME_PREFIX + WRONG_SAME_LENGTH), false);
  });

  test('rejects a token of a different length without throwing', () => {
    assert.equal(guard(SCHEME_PREFIX + 'a'.repeat(63)), false);
    assert.equal(guard(SCHEME_PREFIX + 'a'.repeat(65)), false);
  });

  test('rejects a missing header', () => {
    assert.equal(guard(undefined), false);
  });

  test('rejects another scheme with the right token', () => {
    assert.equal(guard('Basic ' + EXPECTED), false);
  });

  test('rejects the Bearer scheme without a token', () => {
    assert.equal(guard('Bearer'), false);
    assert.equal(guard('Bearer '), false);
  });

  test('rejects extra spaces around the token', () => {
    assert.equal(guard('Bearer  ' + EXPECTED), false);
    assert.equal(guard(SCHEME_PREFIX + EXPECTED + ' '), false);
  });

  test('rejects an empty header', () => {
    assert.equal(guard(''), false);
  });
});
