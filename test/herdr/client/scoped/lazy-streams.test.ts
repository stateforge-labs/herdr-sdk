// Role: the stream members of a client, eager (createStreamMembers, what the lazy loader calls) and lazy (lazyStreams, what every connect function passes), over the fake only.
// Informs plan 10.1 step 3 (the lazy boundary), HERDR-ADR-0007 (subscriptions), HERDR-ADR-0008 (fakes only) and HERDR-ADR-0015 (the lazy row); the size gate measures the chunk itself.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EventKind, SubscriptionType, type PushFrame } from '../../../../src/index.ts';
import { connectCore } from '../../../../src/herdr/client/connect-core.ts';
import { createStreamMembers } from '../../../../src/herdr/client/scoped/streams.ts';
import { lazyStreams } from '../../../../src/herdr/client/scoped/lazy-streams.ts';
import type { WatchOptions } from '../../../../src/herdr/client/watch/types.ts';
import { withFake } from '../../../support/fake.ts';
import { waitUntil } from '../../../support/wait.ts';
import { stubCore } from './support/stub-core.ts';

const WAIT_MS = 1000;
const WORKSPACE_ID = 'w-lazy';

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

const SPECS = [{ type: SubscriptionType.WorkspaceCreated }];

// A snapshot function for watch(); the tests that use it stop the watch before any snapshot is taken.
const NEVER_SNAPSHOT = async (): Promise<never> => {
  throw new Error('no snapshot is taken in this test');
};

describe('stream members over the fake', () => {
  test('eager: createStreamMembers subscribes over its own connection and the fake counts it', async () => {
    await withFake({}, async (fake) => {
      const core = await connectCore({ socketPath: fake.path });
      const members = createStreamMembers(core);
      const subscription = await members.subscribe(SPECS);
      assert.equal(fake.subscriberCount(), 1);
      fake.push(workspaceCreated());
      const next = await subscription[Symbol.asyncIterator]().next();
      assert.equal(next.value?.event, EventKind.WorkspaceCreated);
      subscription.close();
      await waitUntil(() => fake.subscriberCount() === 0, WAIT_MS);
      core.close();
    });
  });

  test('lazy: the lazy subscribe loads the streams on its first call and subscribes the same way', async () => {
    await withFake({}, async (fake) => {
      const core = await connectCore({ socketPath: fake.path });
      const members = lazyStreams(core);
      assert.equal(fake.subscriberCount(), 0, 'nothing is subscribed before the first call');
      const subscription = await members.subscribe(SPECS);
      assert.equal(fake.subscriberCount(), 1);
      assert.deepEqual(fake.requests().at(-1)?.params, { subscriptions: SPECS });
      subscription.close();
      await waitUntil(() => fake.subscriberCount() === 0, WAIT_MS);
      core.close();
    });
  });

  test('lazy: a second subscribe reuses the one load and opens its own subscription', async () => {
    await withFake({}, async (fake) => {
      const core = await connectCore({ socketPath: fake.path });
      const members = lazyStreams(core);
      const first = await members.subscribe(SPECS);
      const second = await members.subscribe(SPECS);
      assert.equal(fake.subscriberCount(), 2);
      first.close();
      second.close();
      await waitUntil(() => fake.subscriberCount() === 0, WAIT_MS);
      core.close();
    });
  });

  test('lazy: hold() loads the streams and returns a held connection that closes', async () => {
    await withFake({}, async (fake) => {
      const core = await connectCore({ socketPath: fake.path });
      const held = await lazyStreams(core).hold();
      await held.close();
      core.close();
    });
  });

  test('lazy: watch() returns at once and close() before iteration ends it without taking a snapshot', async () => {
    const { core, calls } = stubCore();
    const watch = lazyStreams(core).watch({ snapshot: NEVER_SNAPSHOT } as WatchOptions<unknown>);
    watch.close();
    const seen: unknown[] = [];
    for await (const change of watch) {
      seen.push(change);
    }
    assert.deepEqual(seen, []);
    assert.deepEqual(calls, []);
  });
});
