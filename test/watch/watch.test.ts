// Role: checks watch(): the first change is Live with the snapshot, frames between the ack and the snapshot come after Live in order, default specs, onUnknown forwarding, and close/abort ending the iteration normally.
// Informs HERDR-ADR-0016 (W5: snapshot required, no subscribe-only watch), HERDR-ADR-0007 and plan 3.6; the plan 4b checklist rows "snapshot removal fails" and "frames between ack and snapshot".
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { GLOBAL_SUBSCRIPTION_TYPES, WatchKind } from '../../src/constants.ts';
import { createWatch } from '../../src/client/watch/watch.ts';
import type { Watch, WatchChange } from '../../src/client/watch/types.ts';
import { waitUntil } from '../support/wait.ts';
import { agentStatus, paneClosed, unknownFrame } from './support/frames.ts';
import { recordingSleep } from './support/fake-sleep.ts';
import { deferred, settle } from './support/deferred.ts';
import { scriptedSubscribe, subscriptionAt } from './support/scripted-subscribe.ts';

const LIVE_TIMEOUT_MS = 1000;

async function nextChange<S>(iterator: AsyncIterator<WatchChange<S>>): Promise<WatchChange<S>> {
  const result = await iterator.next();
  assert.equal(result.done, false, 'expected a change, the iteration ended');
  return result.value;
}

async function drainUntilDone<S>(iterator: AsyncIterator<WatchChange<S>>): Promise<void> {
  for (;;) {
    const result = await iterator.next();
    if (result.done === true) {
      return;
    }
  }
}

describe('watch', () => {
  test('the first change is Live with the snapshot, and no Frame comes before it', async () => {
    const subs = scriptedSubscribe();
    const watch: Watch<string> = createWatch(subs.subscribe)({ snapshot: async () => 'present', sleep: recordingSleep().sleep });
    const iterator = watch[Symbol.asyncIterator]();
    assert.deepEqual(await nextChange(iterator), { kind: WatchKind.Live, snapshot: 'present' });
    await waitUntil(() => subs.subscriptions.length === 1, LIVE_TIMEOUT_MS);
    subscriptionAt(subs, 0).push(paneClosed('p1'));
    const frame = await nextChange(iterator);
    assert.equal(frame.kind, WatchKind.Frame);
    watch.close();
    await drainUntilDone(iterator);
  });

  test('frames pushed between the ack and the snapshot reply come after Live, in arrival order', async () => {
    const subs = scriptedSubscribe();
    const snapshot = deferred<string>();
    const watch = createWatch(subs.subscribe)({ snapshot: () => snapshot.promise, sleep: recordingSleep().sleep });
    const iterator = watch[Symbol.asyncIterator]();
    const live = iterator.next();
    await waitUntil(() => subs.subscriptions.length === 1, LIVE_TIMEOUT_MS);
    const first = paneClosed('p1');
    const second = agentStatus('p2');
    subscriptionAt(subs, 0).push(first);
    subscriptionAt(subs, 0).push(second);
    await settle();
    snapshot.resolve('present');
    assert.deepEqual((await live).value, { kind: WatchKind.Live, snapshot: 'present' });
    assert.deepEqual((await nextChange(iterator)), { kind: WatchKind.Frame, frame: first });
    assert.deepEqual((await nextChange(iterator)), { kind: WatchKind.Frame, frame: second });
    watch.close();
    await drainUntilDone(iterator);
  });

  test('the default subscriptions are GLOBAL_SUBSCRIPTION_TYPES, each spec carrying only its type', async () => {
    const subs = scriptedSubscribe();
    const watch = createWatch(subs.subscribe)({ snapshot: async () => 0, sleep: recordingSleep().sleep });
    const iterator = watch[Symbol.asyncIterator]();
    await nextChange(iterator);
    const [call] = subs.calls;
    assert.ok(call !== undefined);
    assert.deepEqual(
      call.specs.map((spec) => spec.type),
      GLOBAL_SUBSCRIPTION_TYPES,
    );
    for (const spec of call.specs) {
      assert.deepEqual(Object.keys(spec), ['type']);
    }
    watch.close();
    await drainUntilDone(iterator);
  });

  test('onUnknown is forwarded to subscribe and watch never calls it itself', async () => {
    const subs = scriptedSubscribe();
    let unknownCalls = 0;
    const onUnknown = (): void => {
      unknownCalls += 1;
    };
    const watch = createWatch(subs.subscribe)({ snapshot: async () => 0, onUnknown, sleep: recordingSleep().sleep });
    const iterator = watch[Symbol.asyncIterator]();
    await nextChange(iterator);
    const [call] = subs.calls;
    assert.equal(call?.options.onUnknown, onUnknown);
    subscriptionAt(subs, 0).push(unknownFrame('pane.from_the_future'));
    const change = await nextChange(iterator);
    assert.equal(change.kind, WatchKind.Frame);
    assert.equal(unknownCalls, 0);
    watch.close();
    await drainUntilDone(iterator);
  });

  test('close() ends the iteration normally and closes the subscription', async () => {
    const subs = scriptedSubscribe();
    const watch = createWatch(subs.subscribe)({ snapshot: async () => 0, sleep: recordingSleep().sleep });
    const iterator = watch[Symbol.asyncIterator]();
    await nextChange(iterator);
    watch.close();
    assert.deepEqual(await iterator.next(), { value: undefined, done: true });
    assert.equal(subs.subscriptions[0]?.closed, true);
  });

  test('aborting options.signal ends the iteration the same way close() does', async () => {
    const subs = scriptedSubscribe();
    const controller = new AbortController();
    const watch = createWatch(subs.subscribe)({ snapshot: async () => 0, signal: controller.signal, sleep: recordingSleep().sleep });
    const iterator = watch[Symbol.asyncIterator]();
    await nextChange(iterator);
    controller.abort();
    assert.deepEqual(await iterator.next(), { value: undefined, done: true });
    assert.equal(subs.subscriptions[0]?.closed, true);
  });
});
