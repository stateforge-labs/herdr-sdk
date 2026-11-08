// Role: checks the minimal fake on the wire: W1 (a reused connection gets one answer), W3 (an unparseable line gets the empty id and a close), silence, pong and the unknown-method error.
// Informs HERDR-ADR-0016 (W1, W3, fake facts F1, F3, F6) and plan 5 (the fake's 2a behaviour); new test.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_REPLY_ID, ErrorText, Fake, WireField, WireFact } from '../../../src/constants.ts';
import { Method, PROTOCOL, ResultTag } from '../../../src/herdr/generated/index.ts';
import { encodeRequest } from '../../../src/herdr/wire/envelope.ts';
import { HerdrError } from '../../../src/herdr/wire/errors.ts';
import { rpc } from '../../../src/herdr/wire/rpc.ts';
import { withFake } from '../../support/fake.ts';
import { openRawSocket } from '../../support/raw-socket.ts';
import { rejectionOf } from '../../support/rejection.ts';
import { waitUntil } from '../../support/wait.ts';

const SHORT_MS = 150;
const WAIT_MS = 1000;
const FIRST_ID = 'first';
const SECOND_ID = 'second';

describe('fake herdr on the wire', () => {
  test('W1: a second request on a reused connection is never answered', async () => {
    await withFake({}, async (fake) => {
      const raw = openRawSocket(fake.path);
      raw.write(encodeRequest(FIRST_ID, Method.Ping, {}));
      raw.write(encodeRequest(SECOND_ID, Method.Ping, {}));
      const lines = await raw.untilClosed();
      assert.equal(lines.length, 1);
      assert.equal(JSON.parse(lines[0] ?? '')[WireField.Id], FIRST_ID);
      assert.deepEqual(fake.receivedMethods(), [Method.Ping]);
    });
  });

  test('W3: an unparseable request gets the empty id, an error, then a close', async () => {
    await withFake({}, async (fake) => {
      const raw = openRawSocket(fake.path);
      raw.write('this is not json');
      const lines = await raw.untilClosed();
      assert.equal(lines.length, 1);
      const reply = JSON.parse(lines[0] ?? '') as Record<string, unknown>;
      assert.equal(reply[WireField.Id], EMPTY_REPLY_ID);
      assert.deepEqual(reply[WireField.Error], {
        [WireField.Code]: Fake.InvalidRequestCode,
        [WireField.Message]: 'unparseable request',
      });
    });
  });

  test('a line that is JSON but not an object is treated the same way', async () => {
    await withFake({}, async (fake) => {
      const raw = openRawSocket(fake.path);
      raw.write('[1,2,3]');
      const lines = await raw.untilClosed();
      assert.equal(lines.length, 1);
      assert.equal(JSON.parse(lines[0] ?? '')[WireField.Id], EMPTY_REPLY_ID);
    });
  });

  test('W3 on a held connection: an unparseable line gets the empty id, then the connection closes', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.ClientWindowTitleSet, { type: ResultTag.ClientWindowTitle, changed: true, reason: 'set' });
      const raw = openRawSocket(fake.path);
      raw.write(encodeRequest(FIRST_ID, Method.ClientWindowTitleSet, { title: 'held' }));
      await waitUntil(() => fake.heldCount() === 1, WAIT_MS);
      raw.write('this is not json');
      const lines = await raw.untilClosed();
      assert.equal(lines.length, 2);
      assert.equal(JSON.parse(lines[1] ?? '')[WireField.Id], EMPTY_REPLY_ID);
      await waitUntil(() => fake.heldCount() === 0, WAIT_MS);
    });
  });

  test('silent leaves the connection open until the client closes it', async () => {
    await withFake({}, async (fake) => {
      fake.silent(Method.SessionSnapshot);
      const raw = openRawSocket(fake.path);
      raw.write(encodeRequest(FIRST_ID, Method.SessionSnapshot, {}));
      await waitUntil(() => fake.receivedMethods().length === 1, WAIT_MS);
      assert.equal(fake.connectionCount(), 1);
      raw.destroy();
      await waitUntil(() => fake.connectionCount() === 0, WAIT_MS);
    });
  });

  test('ping answers a pong that advertises the default capabilities', async () => {
    await withFake({}, async (fake) => {
      const pong = await rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.Ping, {});
      assert.equal(pong.protocol, PROTOCOL);
      assert.equal(pong.version, Fake.Version);
      assert.equal(pong.capabilities?.live_handoff, true);
    });
  });

  test('capabilities null leaves the field out of the pong', async () => {
    await withFake({ capabilities: null }, async (fake) => {
      const pong = await rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.Ping, {});
      assert.equal(WireField.Capabilities in pong, false);
    });
  });

  test('the fake reproduces W1 to W6', async () => {
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

  test('the version option shows in the pong', async () => {
    await withFake({ version: '9.9.9-test' }, async (fake) => {
      const pong = await rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.Ping, {});
      assert.equal(pong.version, '9.9.9-test');
    });
  });

  test('a method with no answer gets the unknown-method error', async () => {
    await withFake({}, async (fake) => {
      const error = await rejectionOf(rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.SessionSnapshot, {}));
      assert.ok(error instanceof HerdrError);
      assert.equal(error.code, Fake.UnknownMethodCode);
      assert.equal(error.message, ErrorText.Refused(Method.SessionSnapshot, `unknown method ${Method.SessionSnapshot}`, Fake.UnknownMethodCode));
    });
  });
});
