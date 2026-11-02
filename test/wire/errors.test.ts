// Role: checks the wire error classes: their names, their fields, HerdrError.from and the default of isTimeout.
// Informs HERDR-ADR-0016 and plan 3.1 (error list); new test for the four classes of src/wire/errors.ts.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HerdrError,
  HerdrTransportError,
  ProtocolMismatchError,
  UnsupportedByServerError,
} from '../../src/wire/errors.ts';
import { Method, ServerCapability } from '../../src/generated/index.ts';

describe('HerdrError', () => {
  test('from() carries the code, method and body, and names the class', () => {
    const error = HerdrError.from('ping', { code: 'bad', message: 'nope' });
    assert.ok(error instanceof HerdrError);
    assert.equal(error.name, 'HerdrError');
    assert.equal(error.code, 'bad');
    assert.equal(error.method, 'ping');
    assert.deepEqual(error.body, { code: 'bad', message: 'nope' });
    assert.equal(error.message, 'ping: nope [bad]');
  });
});

describe('HerdrTransportError', () => {
  test('isTimeout defaults to false and cause is optional', () => {
    const error = new HerdrTransportError('boom');
    assert.equal(error.name, 'HerdrTransportError');
    assert.equal(error.isTimeout, false);
    assert.equal(error.cause, undefined);
  });

  test('keeps the cause and the timeout flag when given', () => {
    const cause = new Error('underlying');
    const error = new HerdrTransportError('late', { cause, isTimeout: true });
    assert.equal(error.cause, cause);
    assert.equal(error.isTimeout, true);
  });
});

describe('ProtocolMismatchError', () => {
  test('holds expected and actual and names the class', () => {
    const error = new ProtocolMismatchError(22, 21);
    assert.equal(error.name, 'ProtocolMismatchError');
    assert.equal(error.expected, 22);
    assert.equal(error.actual, 21);
    assert.equal(error.message, 'herdr protocol 21 is not supported (expected 22)');
  });
});

describe('UnsupportedByServerError', () => {
  test('holds the method and the capability and names the class', () => {
    const error = new UnsupportedByServerError(Method.ServerLiveHandoff, ServerCapability.LiveHandoff);
    assert.equal(error.name, 'UnsupportedByServerError');
    assert.equal(error.method, Method.ServerLiveHandoff);
    assert.equal(error.capability, ServerCapability.LiveHandoff);
  });
});
