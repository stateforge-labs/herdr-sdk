// Role: watch(): runs watch cycles, resubscribes with backoff after any failure, and ends normally on close(), abort, or a subscription that ends without failing (the client closed).
// Informs HERDR-ADR-0007, HERDR-ADR-0016 (W5: snapshot first, no subscribe-only mode) and plan 3.6; contract in client/watch/types.ts; one cycle is watch-cycle.ts.
// The consumer's fold must be idempotent: after every Live, frames that arrived between the ack and the snapshot reply are replayed.
import { GLOBAL_SUBSCRIPTION_TYPES } from '../../constants.ts';
import type { Subscribe } from '../subscribe/types.ts';
import { createBackoffState, resolveBackoff } from './backoff.ts';
import { defaultSleep } from './default-sleep.ts';
import { linkSignal } from './merge-signals.ts';
import { sleepOrAbort } from './sleep-or-abort.ts';
import { bareSpecs } from './subscription-specs.ts';
import { runCycle } from './watch-cycle.ts';
import type { CreateWatch, Watch, WatchChange, WatchFn, WatchOptions } from './types.ts';

const DEFAULT_SPECS = bareSpecs(GLOBAL_SUBSCRIPTION_TYPES);

export const createWatch: CreateWatch = (subscribe) => createWatchWithClock(subscribe, Date.now);

// The clock is a parameter so the backoff reset (a cycle up for stableResetMs) is tested with a fake clock. The client uses Date.now.
export function createWatchWithClock(subscribe: Subscribe, now: () => number): WatchFn {
  return function watch<S>(options: WatchOptions<S>): Watch<S> {
    const controller = new AbortController();
    const signal = linkSignal(controller.signal, options.signal);
    return {
      close(): void {
        controller.abort();
      },
      [Symbol.asyncIterator](): AsyncIterator<WatchChange<S>> {
        return watchLoop(subscribe, options, signal, now);
      },
    };
  };
}

// Repeats cycles until one ends normally. A failure sleeps the backoff delay (unless the signal already aborted) and tries again.
async function* watchLoop<S>(
  subscribe: Subscribe,
  options: WatchOptions<S>,
  signal: AbortSignal,
  now: () => number,
): AsyncGenerator<WatchChange<S>, void, undefined> {
  const backoff = createBackoffState(resolveBackoff(options.backoff), now);
  const sleep = options.sleep ?? defaultSleep;
  const specs = options.subscriptions ?? DEFAULT_SPECS;
  while (!signal.aborted) {
    backoff.startCycle();
    try {
      yield* runCycle({ subscribe, specs, options, signal });
      return;
    } catch {
      if (signal.aborted) {
        return;
      }
      await sleepOrAbort(sleep, backoff.delayAfterFailure(), signal);
    }
  }
}
