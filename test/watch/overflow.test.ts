// Role: checks the queue options on watch: DropOldest drops the oldest replayed frame, Fail ends the cycle (its frames are not yielded), and options.queue reaches subscribe unchanged.
// Informs plan 3.6 (QueueOptions) and HERDR-ADR-0016 (W5 replay); the plan 4b checklist row "overflow policy".
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Overflow, WatchKind } from '../../src/constants.ts';
import { createWatch } from '../../src/client/watch/watch.ts';
import type { WatchChange } from '../../src/client/watch/types.ts';
import type { QueueOptions } from '../../src/client/subscribe/types.ts';
import { waitUntil } from '../support/wait.ts';
import { deferred, settle } from './support/deferred.ts';
import { recordingSleep } from './support/fake-sleep.ts';
import { agentStatus, paneClosed } from './support/frames.ts';
import { scriptedSubscribe, subscriptionAt } from './support/scripted-subscribe.ts';

const WAIT_MS = 1000;

async function nextChange(iterator: AsyncIterator<WatchChange<string>>): Promise<WatchChange<string>> {
  const result = await iterator.next();
  assert.equal(result.done, false, 'expected a change, the iteration ended');
  return result.value;
}

describe('watch queue options', () => {
  test('DropOldest keeps the newest frames: with max 2 and three frames before the snapshot, the first is dropped', async () => {
    const subs = scriptedSubscribe();
    const snapshot = deferred<string>();
    const queue: QueueOptions = { max: 2, overflow: Overflow.DropOldest };
    const iterator = createWatch(subs.subscribe)({ snapshot: () => snapshot.promise, queue, sleep: recordingSleep().sleep })[
      Symbol.asyncIterator
    ]();
    const pending = iterator.next();
    await waitUntil(() => subs.subscriptions.length === 1, WAIT_MS);
    const dropped = paneClosed('p1');
    const second = agentStatus('p2');
    const third = agentStatus('p3');
    subscriptionAt(subs, 0).push(dropped);
    subscriptionAt(subs, 0).push(second);
    subscriptionAt(subs, 0).push(third);
    await settle();
    snapshot.resolve('present');
    assert.equal((await pending).value?.kind, WatchKind.Live);
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Frame, frame: second });
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Frame, frame: third });
  });

  test('Fail ends the cycle: none of its frames are yielded, and watch resubscribes with a new Live', async () => {
    const subs = scriptedSubscribe();
    const first = deferred<string>();
    let snapshots = 0;
    const queue: QueueOptions = { max: 2, overflow: Overflow.Fail };
    const sleep = recordingSleep();
    const iterator = createWatch(subs.subscribe)({
      snapshot: () => {
        snapshots += 1;
        return snapshots === 1 ? first.promise : Promise.resolve('second');
      },
      queue,
      sleep: sleep.sleep,
    })[Symbol.asyncIterator]();
    const pending = iterator.next();
    await waitUntil(() => subs.subscriptions.length === 1, WAIT_MS);
    subscriptionAt(subs, 0).push(paneClosed('p1'));
    subscriptionAt(subs, 0).push(agentStatus('p2'));
    subscriptionAt(subs, 0).push(agentStatus('p3'));
    await settle();
    first.resolve('first');
    assert.deepEqual((await pending).value, { kind: WatchKind.Live, snapshot: 'first' });
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'second' });
    assert.equal(subs.calls.length, 2);
    assert.equal(sleep.delays.length, 1);
  });

  test('options.queue reaches subscribe unchanged', async () => {
    const subs = scriptedSubscribe();
    const queue: QueueOptions = { max: 4, overflow: Overflow.DropOldest };
    const iterator = createWatch(subs.subscribe)({ snapshot: async () => 'present', queue, sleep: recordingSleep().sleep })[
      Symbol.asyncIterator
    ]();
    await iterator.next();
    assert.equal(subs.calls[0]?.options.queue, queue);
  });
});
