// Role: pure checks of the backoff table: the defaults, the partial override, the capped delay, and the reset after a stable cycle (fake clock, no real time).
// Informs plan 3.6 and hub ADR-0022 (1 s doubling to 30 s, reset after a stable period); HERDR-ADR-0008 (no real time in tests).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Backoff } from '../../../../src/constants.ts';
import { createBackoffState, nextDelayMs, resolveBackoff } from '../../../../src/herdr/client/watch/backoff.ts';

describe('backoff', () => {
  test('the defaults come from the Backoff constants', () => {
    assert.deepEqual(resolveBackoff(), {
      initialMs: Backoff.InitialMs,
      maxMs: Backoff.MaxMs,
      factor: Backoff.Factor,
      stableResetMs: Backoff.StableResetMs,
    });
  });

  test('a partial policy keeps the defaults for the fields it leaves out', () => {
    const policy = resolveBackoff({ factor: 3 });
    assert.equal(policy.factor, 3);
    assert.equal(policy.initialMs, Backoff.InitialMs);
  });

  test('the delay doubles from the initial value and is capped at the maximum', () => {
    const policy = resolveBackoff();
    const delays = [0, 1, 2, 3, 4, 5, 6].map((attempt) => nextDelayMs(policy, attempt));
    assert.deepEqual(delays, [1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });

  test('a cycle up for at least stableResetMs resets the attempt count; a shorter one does not', () => {
    const policy = resolveBackoff({ stableResetMs: 100 });
    let clock = 0;
    const state = createBackoffState(policy, () => clock);
    state.startCycle();
    clock = 50;
    assert.equal(state.delayAfterFailure(), 1000);
    state.startCycle();
    clock = 60;
    assert.equal(state.delayAfterFailure(), 2000);
    state.startCycle();
    clock = 260;
    assert.equal(state.delayAfterFailure(), 1000);
  });
});
