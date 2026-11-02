// Role: checks the resubscribe loop: a server end or a snapshot failure resubscribes with a new Live, the backoff delays and their cap, the reset after a stable cycle, and close during the sleep.
// Informs HERDR-ADR-0016 (W2, W5) and plan 3.6 (backoff: 1 s doubling to 30 s, reset after 60 s up); the plan 4b checklist "overflow policy" is in overflow.test.ts.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { WatchKind } from '../../src/constants.ts';
import { Method } from '../../src/generated/index.ts';
import { createWatch, createWatchWithClock } from '../../src/client/watch/watch.ts';
import type { WatchChange, WatchOptions } from '../../src/client/watch/types.ts';
import { SubscriptionEnded } from '../../src/wire/errors.ts';
import type { Subscribe } from '../../src/client/subscribe/types.ts';
import { settle } from './support/deferred.ts';
import { recordingSleep, rejectingOnAbort, sleepUntilAbort } from './support/fake-sleep.ts';
import { agentStatus } from './support/frames.ts';
import { scriptedSubscribe, subscriptionAt } from './support/scripted-subscribe.ts';
import { rejectionOf } from '../support/rejection.ts';
import { waitUntil } from '../support/wait.ts';

const WAIT_MS = 1000;

async function nextChange<S>(iterator: AsyncIterator<WatchChange<S>>): Promise<WatchChange<S>> {
  const result = await iterator.next();
  assert.equal(result.done, false, 'expected a change, the iteration ended');
  return result.value;
}

function start<S>(subscribe: Subscribe, options: WatchOptions<S>): AsyncIterator<WatchChange<S>> {
  return createWatch(subscribe)(options)[Symbol.asyncIterator]();
}

// The same watch with a clock the test moves; only the backoff reset reads it.
function startWithClock<S>(subscribe: Subscribe, now: () => number, options: WatchOptions<S>): AsyncIterator<WatchChange<S>> {
  return createWatchWithClock(subscribe, now)(options)[Symbol.asyncIterator]();
}

describe('resubscribe', () => {
  test('a server end resubscribes, takes a new Live, then the new frames', async () => {
    const subs = scriptedSubscribe();
    const sleep = recordingSleep();
    const iterator = start(subs.subscribe, { snapshot: async () => 'snap', sleep: sleep.sleep });
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'snap' });
    subscriptionAt(subs, 0).fail(new SubscriptionEnded(Method.EventsSubscribe));
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'snap' });
    await waitUntil(() => subs.subscriptions.length === 2, WAIT_MS);
    const frame = agentStatus('p9');
    subscriptionAt(subs, 1).push(frame);
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Frame, frame });
    assert.deepEqual(sleep.delays, [1000]);
  });

  test('a snapshot rejection resubscribes', async () => {
    const subs = scriptedSubscribe();
    const sleep = recordingSleep();
    let snapshots = 0;
    const iterator = start(subs.subscribe, {
      snapshot: async () => {
        snapshots += 1;
        if (snapshots === 1) {
          throw new Error('pane.list failed');
        }
        return 'second';
      },
      sleep: sleep.sleep,
    });
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'second' });
    assert.equal(subs.calls.length, 2);
    assert.deepEqual(sleep.delays, [1000]);
  });

  test('the delays double from 1 s and cap at 30 s', async () => {
    const subs = scriptedSubscribe();
    for (let failure = 0; failure < 7; failure += 1) {
      subs.rejectNext(new Error(`ack ${failure}`));
    }
    const sleep = recordingSleep();
    const iterator = start(subs.subscribe, { snapshot: async () => 'ok', sleep: sleep.sleep });
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'ok' });
    assert.deepEqual(sleep.delays, [1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });

  test('stableResetMs 0 is the edge where every cycle counts as stable, so the delay never grows', async () => {
    const subs = scriptedSubscribe();
    subs.rejectNext(new Error('first'));
    subs.rejectNext(new Error('second'));
    const sleep = recordingSleep();
    const iterator = start(subs.subscribe, { snapshot: async () => 'ok', backoff: { stableResetMs: 0 }, sleep: sleep.sleep });
    await nextChange(iterator);
    assert.deepEqual(sleep.delays, [1000, 1000]);
  });

  test('a cycle up for less than stableResetMs keeps the grown delay (fake clock)', async () => {
    const subs = scriptedSubscribe();
    subs.rejectNext(new Error('ack refused'));
    const sleep = recordingSleep();
    let clock = 0;
    const iterator = startWithClock(subs.subscribe, () => clock, {
      snapshot: async () => 'ok',
      backoff: { stableResetMs: 100 },
      sleep: sleep.sleep,
    });
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'ok' });
    clock = 50;
    subscriptionAt(subs, 0).fail(new SubscriptionEnded(Method.EventsSubscribe));
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'ok' });
    assert.deepEqual(sleep.delays, [1000, 2000]);
  });

  test('a cycle up for at least stableResetMs resets the delay to the initial value (fake clock)', async () => {
    const subs = scriptedSubscribe();
    subs.rejectNext(new Error('ack refused'));
    const sleep = recordingSleep();
    let clock = 0;
    const iterator = startWithClock(subs.subscribe, () => clock, {
      snapshot: async () => 'ok',
      backoff: { stableResetMs: 100 },
      sleep: sleep.sleep,
    });
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'ok' });
    clock = 150;
    subscriptionAt(subs, 0).fail(new SubscriptionEnded(Method.EventsSubscribe));
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'ok' });
    assert.deepEqual(sleep.delays, [1000, 1000]);
  });

  test('a Sleep that rejects when its signal aborts ends the iteration normally, not with an error', async () => {
    const subs = scriptedSubscribe();
    subs.rejectNext(new Error('ack refused'));
    const watch = createWatch(subs.subscribe)({ snapshot: async () => 'ok', sleep: rejectingOnAbort });
    const iterator = watch[Symbol.asyncIterator]();
    const pending = iterator.next();
    await waitUntil(() => subs.calls.length === 1, WAIT_MS);
    await settle();
    watch.close();
    assert.deepEqual(await pending, { value: undefined, done: true });
  });

  test('a Sleep that fails for a reason other than the abort is thrown to the consumer', async () => {
    const subs = scriptedSubscribe();
    subs.rejectNext(new Error('ack refused'));
    const failure = new Error('timer broke');
    const iterator = start(subs.subscribe, {
      snapshot: async () => 'ok',
      sleep: async () => {
        throw failure;
      },
    });
    assert.equal(await rejectionOf(iterator.next()), failure);
  });

  test('a partial backoff override is honoured for the other fields', async () => {
    const subs = scriptedSubscribe();
    for (let failure = 0; failure < 4; failure += 1) {
      subs.rejectNext(new Error(`ack ${failure}`));
    }
    const sleep = recordingSleep();
    const iterator = start(subs.subscribe, {
      snapshot: async () => 'ok',
      backoff: { initialMs: 10, factor: 3, maxMs: 100 },
      sleep: sleep.sleep,
    });
    await nextChange(iterator);
    assert.deepEqual(sleep.delays, [10, 30, 90, 100]);
  });

  test('close during the sleep ends the iteration at once', async () => {
    const subs = scriptedSubscribe();
    subs.rejectNext(new Error('ack refused'));
    const watch = createWatch(subs.subscribe)({ snapshot: async () => 'ok', sleep: sleepUntilAbort });
    const iterator = watch[Symbol.asyncIterator]();
    const pending = iterator.next();
    await waitUntil(() => subs.calls.length === 1, WAIT_MS);
    await settle();
    watch.close();
    assert.deepEqual(await pending, { value: undefined, done: true });
    assert.equal(subs.calls.length, 1);
  });
});
