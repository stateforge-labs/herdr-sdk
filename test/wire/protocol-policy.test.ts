// Role: checks the protocol policy: exact match and minimum match, and that exact is the default.
// Informs HERDR-ADR-0009 (protocol-tied versioning) and plan 3.1 (protocolPolicy); ported-and-extended from hub infra/herdr/protocol-policy.ts.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ProtocolPolicy } from '../../src/constants.ts';
import { isSupportedProtocol } from '../../src/wire/protocol-policy.ts';
import { PROTOCOL } from '../../src/generated/index.ts';

describe('isSupportedProtocol', () => {
  test('exact policy accepts an equal protocol', () => {
    assert.equal(isSupportedProtocol(PROTOCOL, ProtocolPolicy.Exact, PROTOCOL), true);
  });

  test('exact policy rejects a different protocol, older or newer', () => {
    assert.equal(isSupportedProtocol(PROTOCOL - 1, ProtocolPolicy.Exact, PROTOCOL), false);
    assert.equal(isSupportedProtocol(PROTOCOL + 1, ProtocolPolicy.Exact, PROTOCOL), false);
  });

  test('minimum policy accepts a protocol greater than or equal to expected', () => {
    assert.equal(isSupportedProtocol(PROTOCOL, ProtocolPolicy.Minimum, PROTOCOL), true);
    assert.equal(isSupportedProtocol(PROTOCOL + 1, ProtocolPolicy.Minimum, PROTOCOL), true);
  });

  test('minimum policy rejects a protocol lower than expected', () => {
    assert.equal(isSupportedProtocol(PROTOCOL - 1, ProtocolPolicy.Minimum, PROTOCOL), false);
  });

  test('the default policy is exact', () => {
    assert.equal(isSupportedProtocol(PROTOCOL + 1), false);
    assert.equal(isSupportedProtocol(PROTOCOL), true);
  });
});
