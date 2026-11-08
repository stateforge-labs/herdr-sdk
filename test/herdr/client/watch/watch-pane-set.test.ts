// Role: checks watchPaneSet(): the initial panes from pane.list, pane.created and pane.closed (follow, idempotent replay), per-pane frames carrying paneId, per-pane types, the refused pane.output_matched, close(), and the client close.
// Informs HERDR-ADR-0016 (W6: per-pane subscriptions with pane_id; lifecycle keeps the set) and plan 3.6; the plan 4b checklist row "watchPaneSet follows created/closed".
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Overflow, PER_PANE_SUBSCRIPTION_TYPES, PaneSetKind } from '../../../../src/constants.ts';
import { SubscriptionType } from '../../../../src/herdr/generated/index.ts';
import { watchPaneSet } from '../../../../src/herdr/client/watch/watch-pane-set.ts';
import type { PaneSetChange, PaneSetWatch, Sleep } from '../../../../src/herdr/client/watch/types.ts';
import type { QueueOptions } from '../../../../src/herdr/client/subscribe/types.ts';
import { rejectionOf } from '../../../support/rejection.ts';
import { waitUntil } from '../../../support/wait.ts';
import { agentStatus, paneClosed, paneCreated } from './support/frames.ts';
import { paneSource, type PaneListing } from './support/pane-source.ts';
import { recordingSleep, rejectingOnAbort } from './support/fake-sleep.ts';
import { scriptedSubscribe, subscriptionAt, type ScriptedSubscribe } from './support/scripted-subscribe.ts';
import { deferred, settle } from './support/deferred.ts';

const WAIT_MS = 1000;

async function nextChange(iterator: AsyncIterator<PaneSetChange>): Promise<PaneSetChange> {
  const result = await iterator.next();
  assert.equal(result.done, false, 'expected a change, the iteration ended');
  return result.value;
}

async function drainUntilDone(iterator: AsyncIterator<PaneSetChange>): Promise<void> {
  for (;;) {
    const result = await iterator.next();
    if (result.done === true) {
      return;
    }
  }
}

// The per-pane subscribe whose specs name this pane.
function paneCallIndex(subs: ScriptedSubscribe, paneId: string): number {
  return subs.calls.findIndex((call) => call.specs.some((spec) => 'pane_id' in spec && spec.pane_id === paneId));
}

async function waitForPaneSubscription(subs: ScriptedSubscribe, paneId: string): Promise<number> {
  await waitUntil(() => paneCallIndex(subs, paneId) >= 0, WAIT_MS);
  await settle();
  return paneCallIndex(subs, paneId);
}

function setup(listing: PaneListing, sleep = recordingSleep()) {
  const subs = scriptedSubscribe();
  const set: PaneSetWatch = watchPaneSet(paneSource(subs.subscribe, listing), { sleep: sleep.sleep });
  return { subs, set, iterator: set[Symbol.asyncIterator](), sleep };
}

describe('watchPaneSet', () => {
  test('the initial panes from pane.list get one per-pane subscription each, and an Added change each', async () => {
    const { subs, iterator } = setup({ ids: ['p1', 'p2'] });
    assert.deepEqual(await nextChange(iterator), { kind: PaneSetKind.Added, paneId: 'p1' });
    assert.deepEqual(await nextChange(iterator), { kind: PaneSetKind.Added, paneId: 'p2' });
    await waitForPaneSubscription(subs, 'p2');
    assert.equal(subs.calls.length, 3, 'lifecycle plus one per pane');
    const [lifecycle] = subs.calls;
    assert.deepEqual(lifecycle?.specs, [{ type: SubscriptionType.PaneCreated }, { type: SubscriptionType.PaneClosed }]);
    const p1 = subs.calls[paneCallIndex(subs, 'p1')];
    assert.deepEqual(p1?.specs, [
      { type: SubscriptionType.PaneAgentStatusChanged, pane_id: 'p1' },
      { type: SubscriptionType.PaneScrollChanged, pane_id: 'p1' },
    ]);
  });

  test('pane.created subscribes the new pane and adds it; pane.closed closes its subscription and removes it; frames carry paneId', async () => {
    const { subs, iterator } = setup({ ids: ['p1'] });
    assert.deepEqual(await nextChange(iterator), { kind: PaneSetKind.Added, paneId: 'p1' });
    await waitForPaneSubscription(subs, 'p1');

    subscriptionAt(subs, 0).push(paneCreated('p3'));
    assert.deepEqual(await nextChange(iterator), { kind: PaneSetKind.Added, paneId: 'p3' });
    await waitForPaneSubscription(subs, 'p3');
    const p3Subscription = subs.subscriptions[paneCallIndex(subs, 'p3')];
    assert.ok(p3Subscription !== undefined);
    const frame = agentStatus('p3');
    p3Subscription.push(frame);
    assert.deepEqual(await nextChange(iterator), { kind: PaneSetKind.Frame, paneId: 'p3', frame });

    subscriptionAt(subs, 0).push(paneClosed('p1'));
    assert.deepEqual(await nextChange(iterator), { kind: PaneSetKind.Removed, paneId: 'p1' });
    assert.equal(subs.subscriptions[paneCallIndex(subs, 'p1')]?.closed, true);
  });

  test('a replayed created or closed frame changes nothing: one Added and one Removed', async () => {
    const { subs, iterator } = setup({ ids: [] });
    const firstChange = iterator.next();
    await waitUntil(() => subs.subscriptions.length === 1, WAIT_MS);
    subscriptionAt(subs, 0).push(paneCreated('p3'));
    subscriptionAt(subs, 0).push(paneCreated('p3'));
    assert.deepEqual((await firstChange).value, { kind: PaneSetKind.Added, paneId: 'p3' });
    subscriptionAt(subs, 0).push(paneClosed('p3'));
    subscriptionAt(subs, 0).push(paneClosed('p3'));
    assert.deepEqual(await nextChange(iterator), { kind: PaneSetKind.Removed, paneId: 'p3' });
    subscriptionAt(subs, 0).push(paneCreated('p4'));
    assert.deepEqual(await nextChange(iterator), { kind: PaneSetKind.Added, paneId: 'p4' });
  });

  test('the default per-pane types are PER_PANE_SUBSCRIPTION_TYPES without pane.output_matched', async () => {
    const { subs, iterator } = setup({ ids: ['p1'] });
    await nextChange(iterator);
    await waitForPaneSubscription(subs, 'p1');
    const expected = PER_PANE_SUBSCRIPTION_TYPES.filter((type) => type !== SubscriptionType.PaneOutputMatched);
    const p1 = subs.calls[paneCallIndex(subs, 'p1')];
    assert.deepEqual(
      p1?.specs.map((spec) => spec.type),
      expected,
    );
  });

  test('pane.output_matched is refused when watchPaneSet is called, not dropped', () => {
    const subs = scriptedSubscribe();
    assert.throws(
      () => watchPaneSet(paneSource(subs.subscribe, { ids: [] }), { types: [SubscriptionType.PaneOutputMatched] }),
      TypeError,
    );
  });

  test('close() closes every subscription of the set', async () => {
    const { subs, set, iterator } = setup({ ids: ['p1', 'p2'] });
    await nextChange(iterator);
    await nextChange(iterator);
    await waitForPaneSubscription(subs, 'p2');
    set.close();
    await drainUntilDone(iterator);
    assert.ok(subs.subscriptions.every((subscription) => subscription.closed));
  });

  test('a pane subscription that fails is resubscribed with backoff while the pane is in the set', async () => {
    const { subs, iterator, sleep } = setup({ ids: ['p1'] });
    await nextChange(iterator);
    const index = await waitForPaneSubscription(subs, 'p1');
    subscriptionAt(subs, index).fail(new Error('connection reset'));
    await waitUntil(() => subs.calls.length === 3, WAIT_MS);
    assert.deepEqual(sleep.delays, [1000]);
    assert.equal(subs.calls[2]?.specs.some((spec) => 'pane_id' in spec && spec.pane_id === 'p1'), true);
  });

  test('the client close ends the set normally and stops every subscription', async () => {
    const clientClosed = new AbortController();
    const subs = scriptedSubscribe(clientClosed.signal);
    const iterator = watchPaneSet(paneSource(subs.subscribe, { ids: ['p1'] }), { sleep: recordingSleep().sleep })[
      Symbol.asyncIterator
    ]();
    await nextChange(iterator);
    clientClosed.abort();
    assert.deepEqual(await iterator.next(), { value: undefined, done: true });
    assert.equal(subs.calls.length, 2, 'no resubscribe after the client closed');
  });

  test('the merged output is unbounded: a bounded queue never drops an Added change, and reaches every pane subscribe', async () => {
    const subs = scriptedSubscribe();
    const queue: QueueOptions = { max: 1, overflow: Overflow.DropOldest };
    const iterator = watchPaneSet(paneSource(subs.subscribe, { ids: ['p1', 'p2', 'p3'] }), {
      queue,
      sleep: recordingSleep().sleep,
    })[Symbol.asyncIterator]();
    assert.deepEqual(await nextChange(iterator), { kind: PaneSetKind.Added, paneId: 'p1' });
    assert.deepEqual(await nextChange(iterator), { kind: PaneSetKind.Added, paneId: 'p2' });
    assert.deepEqual(await nextChange(iterator), { kind: PaneSetKind.Added, paneId: 'p3' });
    await waitForPaneSubscription(subs, 'p1');
    assert.equal(subs.calls[paneCallIndex(subs, 'p1')]?.options.queue, queue);
  });

  test('a lifecycle resubscribe that no longer lists a pane emits Removed for it and closes its subscription', async () => {
    const listing: PaneListing = { ids: ['p1', 'p2'] };
    const { subs, iterator } = setup(listing);
    assert.deepEqual(await nextChange(iterator), { kind: PaneSetKind.Added, paneId: 'p1' });
    assert.deepEqual(await nextChange(iterator), { kind: PaneSetKind.Added, paneId: 'p2' });
    await waitForPaneSubscription(subs, 'p2');
    listing.ids = ['p2'];
    subscriptionAt(subs, 0).fail(new Error('lifecycle reset'));
    assert.deepEqual(await nextChange(iterator), { kind: PaneSetKind.Removed, paneId: 'p1' });
    assert.equal(subs.subscriptions[paneCallIndex(subs, 'p1')]?.closed, true);
  });

  test('a pane whose subscription failed is not resubscribed once it was removed during the backoff', async () => {
    const subs = scriptedSubscribe();
    const gate = deferred<void>();
    const sleeping: number[] = [];
    const sleep: Sleep = async (ms) => {
      sleeping.push(ms);
      await gate.promise;
    };
    const iterator = watchPaneSet(paneSource(subs.subscribe, { ids: ['p1'] }), { sleep })[Symbol.asyncIterator]();
    await nextChange(iterator);
    const index = await waitForPaneSubscription(subs, 'p1');
    subscriptionAt(subs, index).fail(new Error('connection reset'));
    await waitUntil(() => sleeping.length === 1, WAIT_MS);
    subscriptionAt(subs, 0).push(paneClosed('p1'));
    assert.deepEqual(await nextChange(iterator), { kind: PaneSetKind.Removed, paneId: 'p1' });
    gate.resolve();
    await settle();
    await settle();
    assert.equal(subs.calls.length, 2, 'the lifecycle and the first p1 subscription only');
  });

  test('a Sleep that rejects when the set is closed ends the set normally, with no unhandled rejection', async () => {
    const subs = scriptedSubscribe();
    const entered: number[] = [];
    const sleep: Sleep = (ms, signal) => {
      entered.push(ms);
      return rejectingOnAbort(ms, signal);
    };
    const set = watchPaneSet(paneSource(subs.subscribe, { ids: ['p1'] }), { sleep });
    const iterator = set[Symbol.asyncIterator]();
    await nextChange(iterator);
    const index = await waitForPaneSubscription(subs, 'p1');
    subscriptionAt(subs, index).fail(new Error('connection reset'));
    await waitUntil(() => entered.length === 1, WAIT_MS);
    set.close();
    await drainUntilDone(iterator);
    assert.equal(subs.calls.length, 2, 'no resubscribe after close');
  });

  test('a Sleep failure that is not an abort reaches the consumer as the error of its iterator', async () => {
    const subs = scriptedSubscribe();
    const failure = new Error('timer broke');
    const sleep: Sleep = async () => {
      throw failure;
    };
    const iterator = watchPaneSet(paneSource(subs.subscribe, { ids: ['p1'] }), { sleep })[Symbol.asyncIterator]();
    await nextChange(iterator);
    const index = await waitForPaneSubscription(subs, 'p1');
    subscriptionAt(subs, index).fail(new Error('connection reset'));
    assert.equal(await rejectionOf(iterator.next()), failure);
  });

  test.todo('pane.output_matched with its match and source (HERDR-ADR-0016 open issue 8)');
});
