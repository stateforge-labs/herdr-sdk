// Role: a scripted Subscribe: every call opens the next ScriptedSubscription (or rejects the ack when the test asks), and records its specs and options.
// Informs HERDR-ADR-0007 and HERDR-ADR-0016 (W2 ack, then the held stream); lane P4b test helper. The client signal stands in for SubscribeDeps.signal.
import assert from 'node:assert/strict';
import type { Subscribe, SubscribeOptions } from '../../../../../src/herdr/client/subscribe.ts';
import type { Subscription } from '../../../../../src/herdr/generated/index.ts';
import { ScriptedSubscription } from './scripted-subscription.ts';

export interface SubscribeCall {
  readonly specs: readonly Subscription[];
  readonly options: SubscribeOptions;
}

export interface ScriptedSubscribe {
  readonly subscribe: Subscribe;
  readonly calls: SubscribeCall[];
  readonly subscriptions: ScriptedSubscription[];
  /** The next call rejects its ack with this error (it opens no subscription). */
  rejectNext(error: unknown): void;
}

export function scriptedSubscribe(clientSignal?: AbortSignal): ScriptedSubscribe {
  const calls: SubscribeCall[] = [];
  const subscriptions: ScriptedSubscription[] = [];
  const rejections: unknown[] = [];
  const subscribe: Subscribe = async (specs, options = {}) => {
    calls.push({ specs, options });
    const rejection = rejections.shift();
    if (rejection !== undefined) {
      throw rejection;
    }
    const subscription = new ScriptedSubscription();
    subscriptions.push(subscription);
    options.signal?.addEventListener('abort', () => subscription.close(), { once: true });
    clientSignal?.addEventListener('abort', () => subscription.endNormally(), { once: true });
    return subscription;
  };
  return {
    subscribe,
    calls,
    subscriptions,
    rejectNext(error: unknown): void {
      rejections.push(error);
    },
  };
}

// The n-th subscription the test can drive; fails the test with a clear message when the subscribe has not happened yet.
export function subscriptionAt(subs: ScriptedSubscribe, index: number): ScriptedSubscription {
  const subscription = subs.subscriptions[index];
  assert.ok(subscription !== undefined, `no subscription number ${index} yet`);
  return subscription;
}
