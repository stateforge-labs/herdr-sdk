// Role: Watch.update() over the fake: a changed set makes the fake see a second events.subscribe carrying both specs, and only the new subscription stays open.
// Informs plan G6 (updatable subscription set); cross-layer test over createFakeHerdr only, the same shape as watch.test.ts.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { connect, Method, SubscriptionType, WatchKind } from '../../src/index.ts';
import { withFake } from '../support/fake.ts';
import { waitUntil } from '../support/wait.ts';

const WAIT_MS = 1000;
const CREATED = [{ type: SubscriptionType.WorkspaceCreated }];
const CLOSED = [{ type: SubscriptionType.WorkspaceClosed }];

describe('watch().update over the fake', () => {
  test('a changed set re-subscribes with both specs and leaves one subscription open', async () => {
    await withFake({}, async (fake) => {
      const client = await connect({ socketPath: fake.path });
      try {
        const watch = client.watch({ snapshot: async () => 'snap', subscriptions: CREATED });
        const iterator = watch[Symbol.asyncIterator]();
        assert.deepEqual((await iterator.next()).value, { kind: WatchKind.Live, snapshot: 'snap' });

        const both = [...CREATED, ...CLOSED];
        watch.update(both);
        assert.deepEqual((await iterator.next()).value, { kind: WatchKind.Live, snapshot: 'snap' });

        await waitUntil(() => fake.subscriberCount() === 1, WAIT_MS);
        const subscribes = fake.requests().filter((request) => request.method === Method.EventsSubscribe);
        assert.equal(subscribes.length, 2);
        assert.deepEqual(subscribes[1]?.params, { subscriptions: both });

        watch.close();
        assert.equal((await iterator.next()).done, true);
        await waitUntil(() => fake.subscriberCount() === 0, WAIT_MS);
      } finally {
        client.close();
      }
    });
  });
});
