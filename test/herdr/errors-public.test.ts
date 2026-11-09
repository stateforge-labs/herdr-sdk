// Role: checks the errors and constants the main entry exports for callers: UnsupportedWatchError (a TypeError from watchPaneSet), SubscriptionEventKind, and ErrorCode (the codes a HerdrError carries, checked against a scripted fake).
// Informs HERDR-ADR-0014 (executable docs), HERDR-ADR-0017 (contracts) and plan G7; the schema has no enum for error codes, so the drift guard checks their shape only.
import { describe, test } from 'bun:test';
import assert from 'node:assert/strict';
import {
  connect,
  ErrorCode,
  HerdrError,
  SubscriptionEventKind,
  SubscriptionType,
  UnsupportedWatchError,
  watchPaneSet,
} from '../../src/index.ts';
import { Method } from '../../src/herdr/generated/index.ts';
import { withFake } from '../support/fake.ts';
import { rejectionOf } from '../support/rejection.ts';

const SNAKE_CASE = /^[a-z]+(_[a-z]+)*$/;

// watchPaneSet only reads its source when it starts, so an empty source is enough for the synchronous refusal.
const UNUSED_SOURCE = {
  pane: { list: async () => ({ type: 'pane_list', panes: [] }) },
  events: { subscribe: async () => { throw new Error('not used'); } },
} as unknown as Parameters<typeof watchPaneSet>[0];

describe('UnsupportedWatchError', () => {
  test('is a TypeError with its own name', () => {
    const error = new UnsupportedWatchError('x');
    assert.ok(error instanceof TypeError);
    assert.equal(error.name, 'UnsupportedWatchError');
    assert.equal(error.message, 'x');
  });

  test('watchPaneSet throws it synchronously for pane.output_matched', () => {
    assert.throws(
      () => watchPaneSet(UNUSED_SOURCE, { types: [SubscriptionType.PaneOutputMatched] }),
      (error: unknown) => error instanceof UnsupportedWatchError,
    );
  });
});

describe('SubscriptionEventKind', () => {
  test('is exported with the per-pane event names', () => {
    assert.equal(SubscriptionEventKind.PaneScrollChanged, 'pane.scroll_changed');
    assert.equal(SubscriptionEventKind.PaneOutputMatched, 'pane.output_matched');
    assert.equal(SubscriptionEventKind.PaneAgentStatusChanged, 'pane.agent_status_changed');
  });
});

describe('ErrorCode', () => {
  test('names the three agent codes', () => {
    assert.equal(ErrorCode.AgentBlocked, 'agent_blocked');
    assert.equal(ErrorCode.AgentNotFound, 'agent_not_found');
    assert.equal(ErrorCode.AgentPromptStalled, 'agent_prompt_stalled');
  });

  test('every code is a non-empty snake_case string (no schema enum to check against)', () => {
    const values = Object.values(ErrorCode);
    assert.ok(values.length > 0);
    for (const value of values) {
      assert.equal(typeof value, 'string');
      assert.match(value, SNAKE_CASE);
    }
  });

  for (const [name, code] of [
    ['AgentBlocked', ErrorCode.AgentBlocked],
    ['AgentNotFound', ErrorCode.AgentNotFound],
    ['AgentPromptStalled', ErrorCode.AgentPromptStalled],
  ] as const) {
    test(`a refused call carries ErrorCode.${name} as HerdrError.code`, async () => {
      await withFake({}, async (fake) => {
        fake.fail(Method.AgentPrompt, { code, message: `refused: ${code}` });
        const herdr = await connect({ socketPath: fake.path });
        const error = await rejectionOf(herdr.call(Method.AgentPrompt, { target: 'a', text: 'x' }));
        assert.ok(error instanceof HerdrError);
        assert.equal(error.code, code);
        herdr.close();
      });
    });
  }
});
