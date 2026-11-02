// Role: checks the long-lived connections of the full fake: push fan-out, subscriber and held counts, closing from the server side, held pushes, and stop().
// Informs plan 5 (push, subscriberCount, closeSubscribers, holdPushes, heldCount, closeHeld, stop acceptance) and HERDR-ADR-0016 (W1, W2, W6); new test.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { EMPTY_REPLY_ID, Fake, FakeErrorCode, FakeText } from '../../src/constants.ts';
import { EventKind, Method, ResultTag, SubscriptionType } from '../../src/generated/index.ts';
import { encodeRequest } from '../../src/wire/envelope.ts';
import { createFakeHerdr } from '../../src/test-kit.ts';
import { withFake } from '../support/fake.ts';
import { waitUntil } from '../support/wait.ts';
import { linesAtLeast, openLineReader } from './support/lines.ts';

const FIRST_ID = 'first';
const SECOND_ID = 'second';
const WAIT_MS = 1000;
const QUIET_MS = 150;

function subscribe(id: string, type: string): string {
  return encodeRequest(id, Method.EventsSubscribe, { subscriptions: [{ type }] });
}

function workspaceClosed(workspaceId: string) {
  return { event: EventKind.WorkspaceClosed, data: { type: EventKind.WorkspaceClosed, workspace_id: workspaceId } };
}

function quiet(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, QUIET_MS));
}

describe('long-lived connections of the full fake', () => {
  test('a typed push reaches only the subscriptions of its type', async () => {
    await withFake({}, async (fake) => {
      const closed = openLineReader(fake.path);
      const layout = openLineReader(fake.path);
      closed.write(subscribe(FIRST_ID, SubscriptionType.WorkspaceClosed));
      layout.write(subscribe(SECOND_ID, SubscriptionType.LayoutUpdated));
      await linesAtLeast(closed, 1);
      await linesAtLeast(layout, 1);
      fake.push(workspaceClosed('w1'));
      await linesAtLeast(closed, 2);
      await quiet();
      assert.equal(closed.lines.length, 2);
      assert.equal(layout.lines.length, 1);
      closed.destroy();
      layout.destroy();
    });
  });

  test('an unknown push reaches every acknowledged subscription', async () => {
    await withFake({}, async (fake) => {
      const first = openLineReader(fake.path);
      const second = openLineReader(fake.path);
      first.write(subscribe(FIRST_ID, SubscriptionType.WorkspaceClosed));
      second.write(subscribe(SECOND_ID, SubscriptionType.LayoutUpdated));
      await linesAtLeast(first, 1);
      await linesAtLeast(second, 1);
      fake.push({ event: 'future_event', data: { anything: true } });
      await linesAtLeast(first, 2);
      await linesAtLeast(second, 2);
      assert.deepEqual(JSON.parse(first.lines[1] ?? ''), { event: 'future_event', data: { anything: true } });
      first.destroy();
      second.destroy();
    });
  });

  test('subscriberCount goes down when the client closes', async () => {
    await withFake({}, async (fake) => {
      const reader = openLineReader(fake.path);
      reader.write(subscribe(FIRST_ID, SubscriptionType.WorkspaceClosed));
      await linesAtLeast(reader, 1);
      assert.equal(fake.subscriberCount(), 1);
      reader.destroy();
      await waitUntil(() => fake.subscriberCount() === 0, WAIT_MS);
    });
  });

  test('closeSubscribers ends every subscription connection from the server side', async () => {
    await withFake({}, async (fake) => {
      const reader = openLineReader(fake.path);
      reader.write(subscribe(FIRST_ID, SubscriptionType.WorkspaceClosed));
      await linesAtLeast(reader, 1);
      fake.closeSubscribers();
      await reader.closed;
      assert.equal(fake.subscriberCount(), 0);
    });
  });

  test('holdPushes queues pushes until release, which writes them in order once', async () => {
    await withFake({}, async (fake) => {
      const reader = openLineReader(fake.path);
      reader.write(subscribe(FIRST_ID, SubscriptionType.WorkspaceClosed));
      await linesAtLeast(reader, 1);
      const release = fake.holdPushes();
      fake.push(workspaceClosed('a'));
      fake.push(workspaceClosed('b'));
      await quiet();
      assert.equal(reader.lines.length, 1);
      release();
      await linesAtLeast(reader, 3);
      assert.deepEqual(JSON.parse(reader.lines[1] ?? ''), workspaceClosed('a'));
      assert.deepEqual(JSON.parse(reader.lines[2] ?? ''), workspaceClosed('b'));
      release();
      await quiet();
      assert.equal(reader.lines.length, 3);
      reader.destroy();
    });
  });

  test('a held connection stays open after its answer and answers the next request too', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.ClientWindowTitleSet, { type: ResultTag.ClientWindowTitle, changed: true, reason: 'set' });
      const reader = openLineReader(fake.path);
      reader.write(encodeRequest(FIRST_ID, Method.ClientWindowTitleSet, { title: 'held' }));
      await linesAtLeast(reader, 1);
      await waitUntil(() => fake.heldCount() === 1, WAIT_MS);
      reader.write(encodeRequest(SECOND_ID, Method.ClientWindowTitleSet, { title: 'again' }));
      await linesAtLeast(reader, 2);
      assert.equal(fake.heldCount(), 1);
      assert.equal(reader.lines.length, 2);
      reader.destroy();
    });
  });

  test('closeHeld ends every held connection from the server side', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.ClientWindowTitleSet, { type: ResultTag.ClientWindowTitle, changed: true, reason: 'set' });
      const reader = openLineReader(fake.path);
      reader.write(encodeRequest(FIRST_ID, Method.ClientWindowTitleSet, { title: 'held' }));
      await waitUntil(() => fake.heldCount() === 1, WAIT_MS);
      fake.closeHeld();
      await reader.closed;
      assert.equal(fake.heldCount(), 0);
    });
  });

  test('a known event kind that no subscription type names reaches no subscription', async () => {
    await withFake({}, async (fake) => {
      const reader = openLineReader(fake.path);
      reader.write(subscribe(FIRST_ID, SubscriptionType.WorkspaceClosed));
      await linesAtLeast(reader, 1);
      fake.push({
        event: EventKind.PaneOutputChanged,
        data: { type: EventKind.PaneOutputChanged, pane_id: 'p1', revision: 1, workspace_id: 'w1' },
      });
      await quiet();
      assert.equal(reader.lines.length, 1);
      reader.destroy();
    });
  });

  test('an unparseable line ends a held connection too (W3)', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.ClientWindowTitleSet, { type: ResultTag.ClientWindowTitle, changed: true, reason: 'set' });
      const reader = openLineReader(fake.path);
      reader.write(encodeRequest(FIRST_ID, Method.ClientWindowTitleSet, { title: 'held' }));
      await waitUntil(() => fake.heldCount() === 1, WAIT_MS);
      reader.write('not json');
      await reader.closed;
      assert.equal(fake.heldCount(), 0);
      assert.equal(reader.lines.length, 2);
      const reply = JSON.parse(reader.lines[1] ?? '') as { id: string; error: { code: string; message: string } };
      assert.equal(reply.id, EMPTY_REPLY_ID);
      assert.equal(reply.error.code, Fake.InvalidRequestCode);
      assert.equal(reply.error.message, FakeText.InvalidRequest);
    });
  });

  test('a refused request on a held method ends the connection (the fake takes the conservative reading)', async () => {
    await withFake({}, async (fake) => {
      const reader = openLineReader(fake.path);
      reader.write(encodeRequest(FIRST_ID, Method.ClientWindowTitleSet, {}));
      await reader.closed;
      assert.equal(fake.heldCount(), 0);
      const reply = JSON.parse(reader.lines[0] ?? '') as { error: { code: string } };
      assert.equal(reply.error.code, FakeErrorCode.InvalidParams);
    });
  });

  test('stop removes the temp directory the fake made', async () => {
    const fake = await createFakeHerdr({});
    const dir = dirname(fake.path);
    assert.equal(existsSync(dir), true);
    await fake.stop();
    assert.equal(existsSync(dir), false);
  });
});
