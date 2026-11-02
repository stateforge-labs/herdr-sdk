// Role: resubscribe backoff: the policy merged with the Backoff defaults, the delay of an attempt, and the state that resets after a stable cycle.
// Informs plan 3.6 and hub ADR-0022 (1 s doubling to 30 s, reset after a stable period; constants Backoff); contract BackoffPolicy in client/watch/types.ts.
import { Backoff } from '../../constants.ts';
import type { BackoffPolicy } from './types.ts';

const DEFAULT_POLICY: BackoffPolicy = {
  initialMs: Backoff.InitialMs,
  maxMs: Backoff.MaxMs,
  factor: Backoff.Factor,
  stableResetMs: Backoff.StableResetMs,
};

export function resolveBackoff(partial?: Partial<BackoffPolicy>): BackoffPolicy {
  return { ...DEFAULT_POLICY, ...partial };
}

// Delay before attempt number `attempt` (0 is the first retry): InitialMs * Factor^attempt, capped at MaxMs.
export function nextDelayMs(policy: BackoffPolicy, attempt: number): number {
  return Math.min(policy.initialMs * policy.factor ** attempt, policy.maxMs);
}

export interface BackoffState {
  /** Marks the start of a cycle, so the next failure can tell whether it stayed up long enough to reset. */
  startCycle(): void;
  /** Records a failed cycle and returns the delay before the next attempt. */
  delayAfterFailure(): number;
}

// The clock is injected so tests move time instead of waiting for it. A cycle up for at least StableResetMs resets the attempt count.
export function createBackoffState(policy: BackoffPolicy, now: () => number): BackoffState {
  let attempt = 0;
  let startedAt = now();
  return {
    startCycle(): void {
      startedAt = now();
    },
    delayAfterFailure(): number {
      if (now() - startedAt >= policy.stableResetMs) {
        attempt = 0;
      }
      const delay = nextDelayMs(policy, attempt);
      attempt += 1;
      return delay;
    },
  };
}
