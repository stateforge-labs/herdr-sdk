// Role: checks assertLongPollBounds(): agent.start's timeout_ms must be greater than 3000 and at most 300000; other methods never throw.
// Informs HERDR-ADR-0007 and plan 3.6 (agent.start bounds, tools/gen/overrides.ts); new test.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Method } from '../../../../src/herdr/generated/index.ts';
import { assertLongPollBounds } from '../../../../src/herdr/client/long-poll.ts';
import { HerdrTransportError } from '../../../../src/herdr/errors.ts';

const START_MIN_EXCLUSIVE_MS = 3000;
const START_MAX_MS = 300_000;

function startWith(timeoutMs: number): unknown {
  return { kind: 'claude', name: 'reviewer', pane_id: 'p1', timeout_ms: timeoutMs };
}

describe('assertLongPollBounds', () => {
  test('agent.start rejects a timeout at the exclusive minimum', () => {
    assert.throws(() => assertLongPollBounds(Method.AgentStart, startWith(START_MIN_EXCLUSIVE_MS)), HerdrTransportError);
  });

  test('agent.start accepts the first value above the minimum', () => {
    assert.doesNotThrow(() => assertLongPollBounds(Method.AgentStart, startWith(START_MIN_EXCLUSIVE_MS + 1)));
  });

  test('agent.start accepts the maximum', () => {
    assert.doesNotThrow(() => assertLongPollBounds(Method.AgentStart, startWith(START_MAX_MS)));
  });

  test('agent.start rejects a timeout above the maximum', () => {
    assert.throws(() => assertLongPollBounds(Method.AgentStart, startWith(START_MAX_MS + 1)), HerdrTransportError);
  });

  test('agent.start without a timeout is left to the server, not refused here', () => {
    assert.doesNotThrow(() => assertLongPollBounds(Method.AgentStart, { kind: 'claude', name: 'r', pane_id: 'p1' }));
  });

  test('a rejected bound names the method and the value', () => {
    assert.throws(
      () => assertLongPollBounds(Method.AgentStart, startWith(1)),
      (error: unknown) => error instanceof HerdrTransportError && error.message.includes('agent.start') && error.message.includes('1'),
    );
  });

  test('other methods never throw, whatever their timeout', () => {
    assert.doesNotThrow(() => assertLongPollBounds(Method.AgentWait, { target: 'r', timeout_ms: 1 }));
    assert.doesNotThrow(() => assertLongPollBounds(Method.EventsWait, { match_event: { event: 'workspace_created' }, timeout_ms: 999_999_999 }));
    assert.doesNotThrow(() => assertLongPollBounds(Method.Ping, undefined));
  });
});
