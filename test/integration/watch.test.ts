// Role: watch() over the fake: a frame pushed between the ack and the snapshot reply is replayed after Live, in order; a later frame follows; close() ends the iteration.
// Informs HERDR-ADR-0016 (W5 snapshot first, W2 ack then the stream) and plan 3.6 (the replay rule); cross-layer test over createFakeHerdr only.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { connect, EventKind, Method, ResultTag, SubscriptionType, WatchKind, type PushFrame } from '../../src/index.ts';
import { withFake } from '../support/fake.ts';
import { waitUntil } from '../support/wait.ts';

const WAIT_MS = 1000;
// Frames written by the fake reach the client's socket within a few event-loop turns; this lets them land before the snapshot is released.
const FRAME_SETTLE_MS = 20;

function workspaceCreated(id: string): PushFrame {
  return {
    event: EventKind.WorkspaceCreated,
    data: {
      type: 'workspace_created',
      workspace: {
        active_tab_id: `${id}-tab`,
        agent_status: 'idle',
        focused: false,
        label: id,
        number: 1,
        pane_count: 0,
        tab_count: 1,
        workspace_id: id,
      },
    },
  };
}

function frameIdOf(value: unknown): string | undefined {
  const data = (value as { data?: { workspace?: { workspace_id?: string } } }).data;
  return data?.workspace?.workspace_id;
}

describe('watch() over the fake', () => {
  test('frames pushed before the snapshot reply are replayed after Live, in order, then later frames follow', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.PaneList, { type: ResultTag.PaneList, panes: [] });
      const client = await connect({ socketPath: fake.path });
      try {
        let snapshotStarted = false;
        let releaseSnapshot: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => {
          releaseSnapshot = resolve;
        });
        const watch = client.watch({
          subscriptions: [{ type: SubscriptionType.WorkspaceCreated }],
          snapshot: async () => {
            snapshotStarted = true;
            await gate;
            const reply = await client.pane.list({});
            return reply.panes.length;
          },
        });
        const iterator = watch[Symbol.asyncIterator]();
        const live = iterator.next();

        // The ack has arrived once the snapshot starts; the snapshot reply is held back until the frames are in flight.
        await waitUntil(() => snapshotStarted, WAIT_MS);
        fake.push(workspaceCreated('w-a'));
        fake.push(workspaceCreated('w-b'));
        await delay(FRAME_SETTLE_MS);
        releaseSnapshot();

        const first = await live;
        assert.equal(first.value?.kind, WatchKind.Live);
        assert.equal(first.value?.snapshot, 0);

        const replayed = await iterator.next();
        assert.equal(replayed.value?.kind, WatchKind.Frame);
        assert.equal(frameIdOf(replayed.value?.frame), 'w-a');
        const second = await iterator.next();
        assert.equal(frameIdOf(second.value?.frame), 'w-b');

        fake.push(workspaceCreated('w-c'));
        const later = await iterator.next();
        assert.equal(frameIdOf(later.value?.frame), 'w-c');

        watch.close();
        const done = await iterator.next();
        assert.equal(done.done, true);
      } finally {
        client.close();
      }
    });
  });
});
