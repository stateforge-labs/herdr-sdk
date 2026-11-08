// Role: one test per measured herdr wire fact the full fake reproduces (W1-W6), and the reproduces list that names exactly those facts.
// Informs HERDR-ADR-0016 (W1-W6) and plan 5 (acceptance: each fact has a test in test/herdr/test-kit); new test.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_REPLY_ID, EMPTY_SCHEMA_RESULT, Fake, FakeCheckText, FakeErrorCode, FakeMethod, FakeText, WireField, WireFact } from '../../../src/constants.ts';
import { EventKind, Method, ResultTag, SubscriptionEventKind, SubscriptionType } from '../../../src/herdr/generated/index.ts';
import { encodeRequest } from '../../../src/herdr/wire/envelope.ts';
import { HerdrTransportError } from '../../../src/herdr/wire/errors.ts';
import { rpc } from '../../../src/herdr/wire/rpc.ts';
import { withFake } from '../../support/fake.ts';
import { rejectionOf } from '../../support/rejection.ts';
import { openRawSocket } from '../../support/raw-socket.ts';
import { waitUntil } from '../../support/wait.ts';
import { linesAtLeast, openLineReader } from './support/lines.ts';

const FIRST_ID = 'first';
const SECOND_ID = 'second';
const WAIT_MS = 1000;
const QUIET_MS = 150;
const SHORT_MS = 1000;
const WORKSPACE_ID = 'w1';
const PANE_A = 'pane-a';
const PANE_B = 'pane-b';

// Reads one JSON line the fake wrote.
function parse(line: string | undefined): unknown {
  return JSON.parse(line ?? '');
}

// Resolves after a short bounded window, so a test can check that nothing else arrived.
function quiet(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, QUIET_MS));
}

describe('herdr wire facts on the full fake', () => {
  test('W1: a second request on a reused connection is never answered', async () => {
    await withFake({}, async (fake) => {
      const raw = openRawSocket(fake.path);
      raw.write(encodeRequest(FIRST_ID, Method.Ping, {}));
      raw.write(encodeRequest(SECOND_ID, Method.Ping, {}));
      const lines = await raw.untilClosed();
      assert.equal(lines.length, 1);
      assert.deepEqual(fake.receivedMethods(), [Method.Ping]);
      await waitUntil(() => fake.connectionCount() === 0, WAIT_MS);
    });
  });

  test('W2: after the ack, a push is an id-less line on the same connection', async () => {
    await withFake({}, async (fake) => {
      const reader = openLineReader(fake.path);
      reader.write(encodeRequest(FIRST_ID, Method.EventsSubscribe, { subscriptions: [{ type: SubscriptionType.WorkspaceClosed }] }));
      const [ack] = await linesAtLeast(reader, 1);
      assert.deepEqual(parse(ack), { id: FIRST_ID, result: { type: ResultTag.SubscriptionStarted } });
      fake.push({ event: EventKind.WorkspaceClosed, data: { type: EventKind.WorkspaceClosed, workspace_id: WORKSPACE_ID } });
      const lines = await linesAtLeast(reader, 2);
      assert.deepEqual(parse(lines[1]), {
        event: EventKind.WorkspaceClosed,
        data: { type: EventKind.WorkspaceClosed, workspace_id: WORKSPACE_ID },
      });
      reader.destroy();
    });
  });

  test('W2: an ack split in two writes arrives as one line', async () => {
    await withFake({}, async (fake) => {
      fake.splitAck();
      const reader = openLineReader(fake.path);
      reader.write(encodeRequest(FIRST_ID, Method.EventsSubscribe, { subscriptions: [{ type: SubscriptionType.WorkspaceClosed }] }));
      const lines = await linesAtLeast(reader, 1);
      assert.equal(lines.length, 1);
      assert.deepEqual(parse(lines[0]), { id: FIRST_ID, result: { type: ResultTag.SubscriptionStarted } });
      reader.destroy();
    });
  });

  test('W2: a stray line with another id arrives before the ack', async () => {
    await withFake({}, async (fake) => {
      const stray = '{"id":"other","result":{"type":"pong"}}';
      fake.strayLine(stray);
      const reader = openLineReader(fake.path);
      reader.write(encodeRequest(FIRST_ID, Method.EventsSubscribe, { subscriptions: [{ type: SubscriptionType.WorkspaceClosed }] }));
      const lines = await linesAtLeast(reader, 2);
      assert.equal(lines[0], stray);
      assert.deepEqual(parse(lines[1]), { id: FIRST_ID, result: { type: ResultTag.SubscriptionStarted } });
      reader.destroy();
    });
  });

  test('W3: an unparseable request gets the empty id and an error, then the connection closes', async () => {
    await withFake({}, async (fake) => {
      const raw = openRawSocket(fake.path);
      raw.write('not json');
      const lines = await raw.untilClosed();
      assert.equal(lines.length, 1);
      const reply = parse(lines[0]);
      assert.deepEqual(reply, {
        [WireField.Id]: EMPTY_REPLY_ID,
        [WireField.Error]: { [WireField.Code]: Fake.InvalidRequestCode, [WireField.Message]: FakeText.InvalidRequest },
      });
    });
  });

  test('W3, client side: an unparseable reply rejects the rpc call at once, without waiting for its timeout', async () => {
    await withFake({}, async (fake) => {
      fake.rawReply(Method.Ping, 'not json');
      const started = performance.now();
      const error = await rejectionOf(rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.Ping, {}));
      assert.ok(error instanceof HerdrTransportError);
      assert.equal(error.isTimeout, false);
      assert.ok(performance.now() - started < SHORT_MS);
    });
  });

  test('W4: api.schema over the socket answers an empty object', async () => {
    await withFake({}, async (fake) => {
      const raw = openRawSocket(fake.path);
      raw.write(encodeRequest(FIRST_ID, FakeMethod.ApiSchema, {}));
      const lines = await raw.untilClosed();
      assert.deepEqual(parse(lines[0]), { id: FIRST_ID, result: EMPTY_SCHEMA_RESULT });
    });
  });

  test('W5: nothing is replayed after the ack, even for a push sent before the subscribe', async () => {
    await withFake({}, async (fake) => {
      fake.push({ event: EventKind.WorkspaceClosed, data: { type: EventKind.WorkspaceClosed, workspace_id: WORKSPACE_ID } });
      const reader = openLineReader(fake.path);
      reader.write(encodeRequest(FIRST_ID, Method.EventsSubscribe, { subscriptions: [{ type: SubscriptionType.WorkspaceClosed }] }));
      await linesAtLeast(reader, 1);
      await quiet();
      assert.equal(reader.lines.length, 1);
      reader.destroy();
    });
  });

  test('W6: a per-pane subscription without pane_id is refused with invalid_params, and the connection closes', async () => {
    await withFake({}, async (fake) => {
      const raw = openRawSocket(fake.path);
      raw.write(encodeRequest(FIRST_ID, Method.EventsSubscribe, { subscriptions: [{ type: SubscriptionType.PaneScrollChanged }] }));
      const lines = await raw.untilClosed();
      const reply = parse(lines[0]) as { error: { code: string; message: string } };
      assert.equal(reply.error.code, FakeErrorCode.InvalidParams);
      assert.equal(reply.error.message, FakeCheckText.NeedsPaneId(SubscriptionType.PaneScrollChanged));
      assert.equal(fake.subscriberCount(), 0);
    });
  });

  test('W6: a per-pane push reaches only the subscription with that pane_id', async () => {
    await withFake({}, async (fake) => {
      const paneA = openLineReader(fake.path);
      const paneB = openLineReader(fake.path);
      const global = openLineReader(fake.path);
      paneA.write(encodeRequest(FIRST_ID, Method.EventsSubscribe, { subscriptions: [{ type: SubscriptionType.PaneScrollChanged, pane_id: PANE_A }] }));
      paneB.write(encodeRequest(SECOND_ID, Method.EventsSubscribe, { subscriptions: [{ type: SubscriptionType.PaneScrollChanged, pane_id: PANE_B }] }));
      global.write(encodeRequest('third', Method.EventsSubscribe, { subscriptions: [{ type: SubscriptionType.LayoutUpdated }] }));
      await linesAtLeast(paneA, 1);
      await linesAtLeast(paneB, 1);
      await linesAtLeast(global, 1);
      fake.push({
        event: SubscriptionEventKind.PaneScrollChanged,
        data: {
          pane_id: PANE_A,
          workspace_id: WORKSPACE_ID,
          scroll: { max_offset_from_bottom: 0, offset_from_bottom: 0, viewport_rows: 24 },
        },
      });
      await linesAtLeast(paneA, 2);
      await quiet();
      assert.equal(paneA.lines.length, 2);
      assert.equal(paneB.lines.length, 1);
      assert.equal(global.lines.length, 1);
      paneA.destroy();
      paneB.destroy();
      global.destroy();
    });
  });

  test('the fake reproduces exactly W1 to W6', async () => {
    await withFake({}, async (fake) => {
      assert.deepEqual(
        [...fake.reproduces],
        [
          WireFact.W1CloseAfterResponse,
          WireFact.W2AckThenStream,
          WireFact.W3EmptyIdOnUnparseable,
          WireFact.W4SchemaOverSocketIsEmpty,
          WireFact.W5NoHistoryReplay,
          WireFact.W6PerPaneNeedsPaneId,
        ],
      );
    });
  });
});
