// Role: checks WatchOptions.idleMs: an expired idle wait resubscribes with a new Live and no backoff, a frame re-arms the wait, close() aborts it, off values never arm one, and an idle restart leaves the backoff attempt count alone.
// Informs plan G6 (idle resubscribe, the 300000 ms tab-recap value); fakes only (scripted subscribe, a sleep that holds the idle wait and records backoff delays).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { WatchKind } from '../../../../src/constants.ts';
import { Method, SubscriptionType } from '../../../../src/herdr/generated/index.ts';
import type { Subscription } from '../../../../src/herdr/generated/index.ts';
import { createWatch } from '../../../../src/herdr/client/watch.ts';
import type { Sleep, WatchChange, WatchOptions } from '../../../../src/herdr/client/watch.ts';
import { SubscriptionEnded } from '../../../../src/herdr/errors.ts';
import { settle } from './support/deferred.ts';
import { agentStatus } from './support/frames.ts';
import { scriptedSubscribe, subscriptionAt } from './support/scripted-subscribe.ts';
import { waitUntil } from '../../../support/wait.ts';

const WAIT_MS = 1000;
const IDLE_MS = 300000;
const SPECS: readonly Subscription[] = [{ type: SubscriptionType.WorkspaceCreated }];

interface IdleWait {
  readonly signal: AbortSignal;
  expire(): void;
}

interface HeldSleep {
  readonly sleep: Sleep;
  readonly backoffDelays: number[];
  readonly idleWaits: IdleWait[];
}

// The idle wait is held until the test expires it (or the signal aborts); every other delay is a backoff delay and resolves at once.
function heldSleep(): HeldSleep {
  const backoffDelays: number[] = [];
  const idleWaits: IdleWait[] = [];
  const sleep: Sleep = (ms, signal) => {
    if (ms !== IDLE_MS) {
      backoffDelays.push(ms);
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      idleWaits.push({ signal, expire: resolve });
      signal.addEventListener('abort', () => resolve(), { once: true });
    });
  };
  return { sleep, backoffDelays, idleWaits };
}

function liveWait(held: HeldSleep): IdleWait {
  const wait = held.idleWaits.findLast((candidate) => !candidate.signal.aborted);
  assert.ok(wait !== undefined, 'no idle wait is pending');
  return wait;
}

async function nextChange<S>(iterator: AsyncIterator<WatchChange<S>>): Promise<WatchChange<S>> {
  const result = await iterator.next();
  assert.equal(result.done, false, 'expected a change, the iteration ended');
  return result.value;
}

function start<S>(subscribe: ReturnType<typeof scriptedSubscribe>['subscribe'], options: WatchOptions<S>) {
  const watch = createWatch(subscribe)(options);
  return { watch, iterator: watch[Symbol.asyncIterator]() };
}

describe('WatchOptions.idleMs', () => {
  test('an expired idle wait resubscribes with a new Live and requests no backoff', async () => {
    const subs = scriptedSubscribe();
    const held = heldSleep();
    let snapshots = 0;
    const { watch, iterator } = start(subs.subscribe, {
      snapshot: async () => `snap-${++snapshots}`,
      subscriptions: SPECS,
      idleMs: IDLE_MS,
      sleep: held.sleep,
    });
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'snap-1' });
    await waitUntil(() => held.idleWaits.length === 1, WAIT_MS);

    liveWait(held).expire();
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'snap-2' });
    assert.equal(subs.calls.length, 2);
    assert.deepEqual(subs.calls[1]?.specs, SPECS);
    assert.deepEqual(held.backoffDelays, []);
    watch.close();
    assert.equal((await iterator.next()).done, true);
  });

  test('a frame before expiry re-arms the wait, so only the last wait counts', async () => {
    const subs = scriptedSubscribe();
    const held = heldSleep();
    const { watch, iterator } = start(subs.subscribe, { snapshot: async () => 'snap', subscriptions: SPECS, idleMs: IDLE_MS, sleep: held.sleep });
    await nextChange(iterator);
    await waitUntil(() => held.idleWaits.length === 1, WAIT_MS);

    const frame = agentStatus('p1');
    subscriptionAt(subs, 0).push(frame);
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Frame, frame });
    assert.equal(held.idleWaits[0]?.signal.aborted, true);
    await waitUntil(() => held.idleWaits.length === 2, WAIT_MS);

    held.idleWaits[0]?.expire();
    await settle();
    assert.equal(subs.calls.length, 1, 'the superseded wait does not restart the cycle');

    liveWait(held).expire();
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'snap' });
    assert.equal(subs.calls.length, 2);
    watch.close();
    assert.equal((await iterator.next()).done, true);
  });

  test('close() aborts the pending idle wait', async () => {
    const subs = scriptedSubscribe();
    const held = heldSleep();
    const { watch, iterator } = start(subs.subscribe, { snapshot: async () => 'snap', subscriptions: SPECS, idleMs: IDLE_MS, sleep: held.sleep });
    await nextChange(iterator);
    await waitUntil(() => held.idleWaits.length === 1, WAIT_MS);
    watch.close();
    assert.equal(held.idleWaits[0]?.signal.aborted, true);
    assert.equal((await iterator.next()).done, true);
    assert.deepEqual(held.backoffDelays, []);
  });

  test('idleMs of 0, NaN or undefined never arms a wait', async () => {
    for (const idleMs of [0, Number.NaN, undefined]) {
      const subs = scriptedSubscribe();
      const held = heldSleep();
      const { watch, iterator } = start(subs.subscribe, { snapshot: async () => 'snap', subscriptions: SPECS, idleMs, sleep: held.sleep });
      await nextChange(iterator);
      await settle();
      assert.equal(held.idleWaits.length, 0, `idleMs ${String(idleMs)} armed a wait`);
      watch.close();
      assert.equal((await iterator.next()).done, true);
    }
  });

  test('an idle restart does not reset or advance the backoff attempt count', async () => {
    const subs = scriptedSubscribe();
    const held = heldSleep();
    const { watch, iterator } = start(subs.subscribe, { snapshot: async () => 'snap', subscriptions: SPECS, idleMs: IDLE_MS, sleep: held.sleep });
    await nextChange(iterator);

    subscriptionAt(subs, 0).fail(new SubscriptionEnded(Method.EventsSubscribe));
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'snap' });
    assert.deepEqual(held.backoffDelays, [1000]);

    await waitUntil(() => held.idleWaits.length === 2, WAIT_MS);
    liveWait(held).expire();
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'snap' });
    assert.equal(subs.calls.length, 3);
    assert.deepEqual(held.backoffDelays, [1000], 'the idle restart requested no backoff');

    subscriptionAt(subs, 2).fail(new SubscriptionEnded(Method.EventsSubscribe));
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'snap' });
    assert.deepEqual(held.backoffDelays, [1000, 2000]);
    watch.close();
    assert.equal((await iterator.next()).done, true);
  });
});
