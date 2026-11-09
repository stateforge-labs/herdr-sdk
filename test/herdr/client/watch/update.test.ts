// Role: checks Watch.update(): a changed set re-subscribes with a new Live and no backoff, an equal set is a no-op, and update works before iteration, after close, during a backoff sleep and during a snapshot.
// Informs HERDR-ADR-0016 (W2, W5) and plan G6 (updatable subscription set); fakes only (scripted subscribe, recording sleep).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { WatchKind } from '../../../../src/constants.ts';
import { SubscriptionType } from '../../../../src/herdr/generated/index.ts';
import type { Subscription } from '../../../../src/herdr/generated/index.ts';
import { createWatch } from '../../../../src/herdr/client/watch.ts';
import type { Sleep, WatchChange, WatchOptions } from '../../../../src/herdr/client/watch.ts';
import { recordingSleep, sleepUntilAbort } from './support/fake-sleep.ts';
import { scriptedSubscribe, subscriptionAt } from './support/scripted-subscribe.ts';
import { waitUntil } from '../../../support/wait.ts';

const WAIT_MS = 1000;
const CREATED: readonly Subscription[] = [{ type: SubscriptionType.WorkspaceCreated }];
const CLOSED: readonly Subscription[] = [{ type: SubscriptionType.WorkspaceClosed }];
const BOTH: readonly Subscription[] = [...CREATED, ...CLOSED];

async function nextChange<S>(iterator: AsyncIterator<WatchChange<S>>): Promise<WatchChange<S>> {
  const result = await iterator.next();
  assert.equal(result.done, false, 'expected a change, the iteration ended');
  return result.value;
}

function watchWith<S>(subscribe: ReturnType<typeof scriptedSubscribe>['subscribe'], options: WatchOptions<S>) {
  return createWatch(subscribe)(options);
}

describe('Watch.update', () => {
  test('a changed set re-subscribes with the new specs, closes the old subscription and yields a new Live', async () => {
    const subs = scriptedSubscribe();
    const sleep = recordingSleep();
    let snapshots = 0;
    const watch = watchWith(subs.subscribe, { snapshot: async () => `snap-${++snapshots}`, subscriptions: CREATED, sleep: sleep.sleep });
    const iterator = watch[Symbol.asyncIterator]();
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'snap-1' });

    watch.update(CLOSED);
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'snap-2' });
    assert.deepEqual(
      subs.calls.map((call) => call.specs),
      [CREATED, CLOSED],
    );
    assert.equal(subscriptionAt(subs, 0).closed, true);
    assert.equal(subscriptionAt(subs, 1).closed, false);
    assert.deepEqual(sleep.delays, []);
    watch.close();
    assert.equal((await iterator.next()).done, true);
  });

  test('an equal set in another order is a no-op', async () => {
    const subs = scriptedSubscribe();
    const watch = watchWith(subs.subscribe, { snapshot: async () => 'snap', subscriptions: BOTH });
    const iterator = watch[Symbol.asyncIterator]();
    await nextChange(iterator);
    watch.update([...BOTH].reverse());
    watch.update(BOTH);
    assert.equal(subs.calls.length, 1);
    watch.close();
    assert.equal((await iterator.next()).done, true);
  });

  test('update before iteration only changes the initial set', async () => {
    const subs = scriptedSubscribe();
    const watch = watchWith(subs.subscribe, { snapshot: async () => 'snap', subscriptions: CREATED });
    watch.update(CLOSED);
    const iterator = watch[Symbol.asyncIterator]();
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'snap' });
    assert.equal(subs.calls.length, 1);
    assert.deepEqual(subs.calls[0]?.specs, CLOSED);
    watch.close();
    assert.equal((await iterator.next()).done, true);
  });

  test('update after close is a no-op and the iteration stays ended', async () => {
    const subs = scriptedSubscribe();
    const watch = watchWith(subs.subscribe, { snapshot: async () => 'snap', subscriptions: CREATED });
    const iterator = watch[Symbol.asyncIterator]();
    watch.close();
    watch.update(CLOSED);
    assert.equal((await iterator.next()).done, true);
    assert.equal(subs.calls.length, 0);
  });

  test('update during a backoff sleep cuts the sleep short and subscribes with the new set', async () => {
    const subs = scriptedSubscribe();
    const delays: number[] = [];
    const sleep: Sleep = (ms, signal) => {
      delays.push(ms);
      return sleepUntilAbort(ms, signal);
    };
    subs.rejectNext(new Error('ack refused'));
    const watch = watchWith(subs.subscribe, { snapshot: async () => 'snap', subscriptions: CREATED, sleep });
    const iterator = watch[Symbol.asyncIterator]();
    const live = nextChange(iterator);
    await waitUntil(() => delays.length === 1, WAIT_MS);
    watch.update(CLOSED);
    assert.deepEqual(await live, { kind: WatchKind.Live, snapshot: 'snap' });
    assert.deepEqual(
      subs.calls.map((call) => call.specs),
      [CREATED, CLOSED],
    );
    assert.equal(delays.length, 1, 'no further backoff sleep after the update');
    watch.close();
    assert.equal((await iterator.next()).done, true);
  });

  test('update while the snapshot is pending aborts it and the second snapshot is used', async () => {
    const subs = scriptedSubscribe();
    const snapshotSignals: AbortSignal[] = [];
    const sleep = recordingSleep();
    const watch = watchWith(subs.subscribe, {
      subscriptions: CREATED,
      sleep: sleep.sleep,
      snapshot: async (signal) => {
        snapshotSignals.push(signal);
        if (snapshotSignals.length === 1) {
          return new Promise<string>((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('snapshot aborted')), { once: true });
          });
        }
        return 'second';
      },
    });
    const iterator = watch[Symbol.asyncIterator]();
    const live = nextChange(iterator);
    await waitUntil(() => snapshotSignals.length === 1, WAIT_MS);
    watch.update(CLOSED);
    assert.deepEqual(await live, { kind: WatchKind.Live, snapshot: 'second' });
    assert.equal(snapshotSignals[0]?.aborted, true);
    assert.deepEqual(sleep.delays, []);
    watch.close();
    assert.equal((await iterator.next()).done, true);
  });

  test('two updates in a row end with the last set', async () => {
    const subs = scriptedSubscribe();
    let snapshots = 0;
    const watch = watchWith(subs.subscribe, { snapshot: async () => `snap-${++snapshots}`, subscriptions: CREATED });
    const iterator = watch[Symbol.asyncIterator]();
    await nextChange(iterator);
    watch.update(CLOSED);
    watch.update(BOTH);
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'snap-2' });
    assert.deepEqual(subs.calls.at(-1)?.specs, BOTH);
    const last = subscriptionAt(subs, subs.subscriptions.length - 1);
    assert.equal(last.closed, false);
    for (let index = 0; index < subs.subscriptions.length - 1; index += 1) {
      assert.equal(subscriptionAt(subs, index).closed, true);
    }
    watch.close();
    assert.equal((await iterator.next()).done, true);
  });
});
