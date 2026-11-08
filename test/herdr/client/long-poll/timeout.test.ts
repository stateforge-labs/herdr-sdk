// Role: checks requestTimeoutMs(): each LONG_POLL row waits timeout_ms plus the margin; agent.prompt without wait, a non-long-poll method, a missing or null timeout fall back to the client's timeout.
// Informs HERDR-ADR-0007 and plan 3.6 (LONG_POLL table, Timeout.LongPollMarginMs); new test.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Timeout } from '../../../../src/constants.ts';
import { LONG_POLL, Method } from '../../../../src/herdr/generated/index.ts';
import { requestTimeoutMs } from '../../../../src/herdr/client/long-poll.ts';

const FALLBACK_MS = 10_000;
const TIMEOUT_MS = 7_000;

// One row per LONG_POLL method: where its timeout_ms sits in the params, and the field that must be present for it to count (agent.prompt).
const ROWS: readonly { method: Method; path: readonly string[]; gate?: string }[] = [
  { method: Method.AgentPrompt, path: ['wait', 'timeout_ms'], gate: 'wait' },
  { method: Method.AgentStart, path: ['timeout_ms'] },
  { method: Method.AgentWait, path: ['timeout_ms'] },
  { method: Method.EventsWait, path: ['timeout_ms'] },
  { method: Method.PaneWaitForOutput, path: ['timeout_ms'] },
];

// Builds params that hold `value` at `path`.
function paramsAt(path: readonly string[], value: unknown): unknown {
  return path.reduceRight<unknown>((inner, key) => ({ [key]: inner }), value);
}

describe('requestTimeoutMs', () => {
  test('the rows here are exactly the LONG_POLL table', () => {
    assert.deepEqual(ROWS.map((row) => row.method).sort(), Object.keys(LONG_POLL).sort());
  });

  for (const row of ROWS) {
    test(`${row.method} waits timeout_ms plus the margin`, () => {
      const params = paramsAt(row.path, TIMEOUT_MS);
      assert.equal(requestTimeoutMs(row.method, params, FALLBACK_MS), TIMEOUT_MS + Timeout.LongPollMarginMs);
    });

    test(`${row.method} without its timeout_ms falls back to the client timeout`, () => {
      const params = row.gate === undefined ? {} : paramsAt([row.gate], {});
      assert.equal(requestTimeoutMs(row.method, params, FALLBACK_MS), FALLBACK_MS);
    });

    test(`${row.method} with a null timeout_ms falls back to the client timeout`, () => {
      assert.equal(requestTimeoutMs(row.method, paramsAt(row.path, null), FALLBACK_MS), FALLBACK_MS);
    });
  }

  test('agent.prompt without wait is an ordinary request and gets the fallback', () => {
    assert.equal(requestTimeoutMs(Method.AgentPrompt, { target: 'reviewer', text: 'go' }, FALLBACK_MS), FALLBACK_MS);
  });

  test('a method that is not long-poll always gets the fallback', () => {
    assert.equal(requestTimeoutMs(Method.Ping, { timeout_ms: TIMEOUT_MS }, FALLBACK_MS), FALLBACK_MS);
  });

  test('an undefined fallback stays undefined', () => {
    assert.equal(requestTimeoutMs(Method.Ping, {}, undefined), undefined);
    assert.equal(requestTimeoutMs(Method.AgentWait, {}, undefined), undefined);
  });

  test('params that are not an object fall back instead of throwing', () => {
    assert.equal(requestTimeoutMs(Method.AgentWait, undefined, FALLBACK_MS), FALLBACK_MS);
    assert.equal(requestTimeoutMs(Method.AgentWait, 'text', FALLBACK_MS), FALLBACK_MS);
  });
});
