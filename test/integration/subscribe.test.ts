// Role: events.subscribe over the fake: the ack, a pushed frame reaching the subscriber, an unknown kind reaching onUnknown, a server close, and close() on the client side.
// Informs HERDR-ADR-0007 (subscriptions), HERDR-ADR-0016 (W2 ack then id-less pushes, P3 unknown kinds) and plan 3.6; cross-layer test over createFakeHerdr only.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  connect,
  EventKind,
  Method,
  SubscriptionEnded,
  SubscriptionType,
  UNKNOWN_EVENT,
  type PushFrame,
  type UnknownFrame,
} from '../../src/index.ts';
import { withFake } from '../support/fake.ts';
import { rejectionOf } from '../support/rejection.ts';
import { waitUntil } from '../support/wait.ts';

const WAIT_MS = 1000;
const WORKSPACE_ID = 'w-1';

// A workspace-created push as herdr sends it: an event name and its data, with no id.
function workspaceCreated(): PushFrame {
  return {
    event: EventKind.WorkspaceCreated,
    data: {
      type: 'workspace_created',
      workspace: {
        active_tab_id: 't-1',
        agent_status: 'idle',
        focused: true,
        label: 'main',
        number: 1,
        pane_count: 1,
        tab_count: 1,
        workspace_id: WORKSPACE_ID,
      },
    },
  };
}

describe('events.subscribe over the fake', () => {
  test('the subscription request carries the specs, and a pushed frame of a subscribed type reaches the iterator', async () => {
    await withFake({}, async (fake) => {
      const client = await connect({ socketPath: fake.path });
      try {
        const specs = [{ type: SubscriptionType.WorkspaceCreated }];
        const subscription = await client.events.subscribe(specs);
        assert.equal(fake.subscriberCount(), 1);
        assert.deepEqual(fake.requests().at(-1)?.params, { subscriptions: specs });

        fake.push(workspaceCreated());
        const iterator = subscription[Symbol.asyncIterator]();
        const next = await iterator.next();
        assert.equal(next.done, false);
        assert.equal(next.value?.event, EventKind.WorkspaceCreated);

        subscription.close();
        await waitUntil(() => fake.subscriberCount() === 0, WAIT_MS);
      } finally {
        client.close();
      }
    });
  });

  test('a frame of a kind this library does not know reaches onUnknown and the iterator as an UnknownFrame', async () => {
    await withFake({}, async (fake) => {
      const seen: UnknownFrame[] = [];
      const client = await connect({ socketPath: fake.path, onUnknown: (frame) => seen.push(frame) });
      try {
        const subscription = await client.events.subscribe([{ type: SubscriptionType.WorkspaceCreated }]);
        fake.push({ event: 'future_kind', data: { anything: true } });
        const next = await subscription[Symbol.asyncIterator]().next();
        assert.equal(next.value?.event, UNKNOWN_EVENT);
        assert.equal(seen.length, 1);
        assert.equal(seen[0]?.rawEvent, 'future_kind');
        subscription.close();
      } finally {
        client.close();
      }
    });
  });

  test('a server close ends the subscription with SubscriptionEnded', async () => {
    await withFake({}, async (fake) => {
      const client = await connect({ socketPath: fake.path });
      try {
        const subscription = await client.events.subscribe([{ type: SubscriptionType.WorkspaceCreated }]);
        const iterator = subscription[Symbol.asyncIterator]();
        fake.closeSubscribers();
        const error = await rejectionOf(iterator.next());
        assert.ok(error instanceof SubscriptionEnded);
        assert.equal(error.message.includes(Method.EventsSubscribe), true);
      } finally {
        client.close();
      }
    });
  });

  test('closing the client ends the subscription on the server side', async () => {
    await withFake({}, async (fake) => {
      const client = await connect({ socketPath: fake.path });
      await client.events.subscribe([{ type: SubscriptionType.WorkspaceCreated }]);
      assert.equal(fake.subscriberCount(), 1);
      client.close();
      await waitUntil(() => fake.subscriberCount() === 0, WAIT_MS);
    });
  });
});
