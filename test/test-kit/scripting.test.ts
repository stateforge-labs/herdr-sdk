// Role: checks how a test scripts the full fake: replySequence, fail, rawReply, the request checker against the generated shapes, the record of requests, and the options.
// Informs plan 5 (scripting API acceptance) and HERDR-ADR-0016 (W4, F3); new test.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CAPABILITIES, Fake, FakeCheckText, FakeErrorCode, SpecField, WireField } from '../../src/constants.ts';
import { Method, PROTOCOL, ResultTag } from '../../src/generated/index.ts';
import { encodeRequest } from '../../src/wire/envelope.ts';
import { HerdrError } from '../../src/wire/errors.ts';
import { rpc } from '../../src/wire/rpc.ts';
import { withFake } from '../support/fake.ts';
import { openRawSocket } from '../support/raw-socket.ts';
import { rejectionOf } from '../support/rejection.ts';
import { waitUntil } from '../support/wait.ts';
import { openLineReader } from './support/lines.ts';

const SHORT_MS = 1000;
const REQUEST_ID = 'req';
const QUIET_MS = 150;

// A client-window-title result, as the typed fake accepts it.
function titleResult(changed: boolean) {
  return { type: ResultTag.ClientWindowTitle, changed, reason: 'set' as const };
}

// Sends one raw request on a fresh connection and returns the first line the fake wrote.
async function firstLineFor(path: string, method: string, params: unknown): Promise<unknown> {
  const raw = openRawSocket(path);
  raw.write(encodeRequest(REQUEST_ID, method, params));
  const lines = await raw.untilClosed();
  return JSON.parse(lines[0] ?? '');
}

function errorCodeOf(reply: unknown): unknown {
  return (reply as { error?: { code?: unknown } }).error?.code;
}

// Resolves after a short window, so a test can check that nothing else happened.
function quiet(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, QUIET_MS));
}

describe('scripting the full fake', () => {
  test('replySequence gives its steps in order, then falls back to reply', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.ClientWindowTitleSet, titleResult(true));
      fake.replySequence(Method.ClientWindowTitleSet, [{ error: { code: 'busy_test', message: 'busy' } }, { result: titleResult(false) }]);
      const first = await rejectionOf(rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.ClientWindowTitleSet, { title: 'a' }));
      assert.ok(first instanceof HerdrError);
      assert.equal(first.code, 'busy_test');
      const second = await rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.ClientWindowTitleSet, { title: 'a' });
      assert.deepEqual(second, titleResult(false));
      const third = await rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.ClientWindowTitleSet, { title: 'a' });
      assert.deepEqual(third, titleResult(true));
    });
  });

  test('fail answers every later call with the same error envelope', async () => {
    await withFake({}, async (fake) => {
      fake.fail(Method.ClientWindowTitleSet, { code: 'refused_test', message: 'no' });
      for (let call = 0; call < 2; call += 1) {
        const error = await rejectionOf(rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.ClientWindowTitleSet, { title: 'a' }));
        assert.ok(error instanceof HerdrError);
        assert.equal(error.code, 'refused_test');
      }
    });
  });

  test('rawReply writes the line as it is, then ends the connection', async () => {
    await withFake({}, async (fake) => {
      fake.rawReply(Method.PaneReportMetadata, 'not a reply');
      const raw = openRawSocket(fake.path);
      raw.write(encodeRequest(REQUEST_ID, Method.PaneReportMetadata, { pane_id: 'p', source: 's' }));
      assert.deepEqual(await raw.untilClosed(), ['not a reply']);
    });
  });

  test('the request checker refuses a missing required field before any reply', async () => {
    await withFake({}, async (fake) => {
      const reply = await firstLineFor(fake.path, Method.PaneReportMetadata, { source: 's' });
      assert.equal(errorCodeOf(reply), FakeErrorCode.InvalidParams);
      assert.equal(
        (reply as { error: { message: string } }).error.message,
        FakeCheckText.MissingField(Method.PaneReportMetadata, 'pane_id'),
      );
    });
  });

  test('the request checker refuses a field of the wrong kind', async () => {
    await withFake({}, async (fake) => {
      const reply = await firstLineFor(fake.path, Method.PaneReportMetadata, { pane_id: 5, source: 's' });
      assert.equal(errorCodeOf(reply), FakeErrorCode.InvalidParams);
      assert.equal((reply as { error: { message: string } }).error.message, FakeCheckText.WrongKind(Method.PaneReportMetadata, 'pane_id'));
    });
  });

  test('the request checker refuses a value outside the allowed enum', async () => {
    await withFake({}, async (fake) => {
      const reply = await firstLineFor(fake.path, Method.AgentRead, { target: 't', source: 'visible', format: 'bogus' });
      assert.equal(errorCodeOf(reply), FakeErrorCode.InvalidParams);
      assert.equal((reply as { error: { message: string } }).error.message, FakeCheckText.NotInEnum(Method.AgentRead, 'format'));
    });
  });

  test('the request checker refuses a metadata key the generated pattern does not allow', async () => {
    await withFake({}, async (fake) => {
      const reply = await firstLineFor(fake.path, Method.WorkspaceReportMetadata, {
        workspace_id: 'w',
        source: 's',
        tokens: { 'bad key!': 'x' },
      });
      assert.equal(errorCodeOf(reply), FakeErrorCode.InvalidParams);
      assert.equal(
        (reply as { error: { message: string } }).error.message,
        FakeCheckText.KeyNotAllowed(Method.WorkspaceReportMetadata, 'tokens'),
      );
    });
  });

  test('params that fit the shape reach the reply', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.ClientWindowTitleSet, titleResult(true));
      const result = await rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.ClientWindowTitleSet, { title: 'ok' });
      assert.deepEqual(result, titleResult(true));
    });
  });

  test('requests() records each request parsed, in order, and receivedMethods() lists them', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.ClientWindowTitleSet, titleResult(true));
      await rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.Ping, {});
      await rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.ClientWindowTitleSet, { title: 'x' });
      const requests = fake.requests();
      assert.deepEqual(
        requests.map((request) => request.method),
        [Method.Ping, Method.ClientWindowTitleSet],
      );
      assert.deepEqual(requests[1]?.params, { title: 'x' });
      assert.deepEqual(fake.receivedMethods(), [Method.Ping, Method.ClientWindowTitleSet]);
      assert.equal(typeof requests[0]?.id, 'string');
    });
  });

  test('capabilities default to the fake set, and a given set is advertised as it is', async () => {
    await withFake({}, async (fake) => {
      assert.deepEqual(fake.capabilities, DEFAULT_CAPABILITIES);
    });
    await withFake({ capabilities: { live_handoff: false } }, async (fake) => {
      const pong = await rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.Ping, {});
      assert.equal(pong.capabilities?.live_handoff, false);
    });
  });

  test('capabilities null leaves the field out of the pong', async () => {
    await withFake({ capabilities: null }, async (fake) => {
      assert.equal(fake.capabilities, null);
      const pong = await rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.Ping, {});
      assert.equal(WireField.Capabilities in pong, false);
    });
  });

  test('a sequence on a method with no reply or default ends in unknown_method once its steps are used', async () => {
    await withFake({}, async (fake) => {
      fake.replySequence(Method.ClientWindowTitleSet, [{ result: titleResult(true) }]);
      assert.deepEqual(await rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.ClientWindowTitleSet, { title: 'a' }), titleResult(true));
      const error = await rejectionOf(rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.ClientWindowTitleSet, { title: 'a' }));
      assert.ok(error instanceof HerdrError);
      assert.equal(error.code, Fake.UnknownMethodCode);
    });
  });

  test('silent accepts a request and never answers, and the connection stays open', async () => {
    await withFake({}, async (fake) => {
      fake.silent(Method.Ping);
      const reader = openLineReader(fake.path);
      reader.write(encodeRequest(REQUEST_ID, Method.Ping, {}));
      await waitUntil(() => fake.receivedMethods().length === 1, SHORT_MS);
      const closedBy = await Promise.race([reader.closed.then(() => true), quiet().then(() => false)]);
      assert.equal(closedBy, false);
      assert.equal(reader.lines.length, 0);
      assert.equal(fake.connectionCount(), 1);
      reader.destroy();
    });
  });

  test('events.subscribe refuses a spec that is not a subscription type, or not an object', async () => {
    for (const subscriptions of [[{ type: 'not.a.type' }], ['not a spec']]) {
      await withFake({}, async (fake) => {
        const reply = await firstLineFor(fake.path, Method.EventsSubscribe, { subscriptions });
        assert.equal(errorCodeOf(reply), FakeErrorCode.InvalidParams);
        assert.equal(
          (reply as { error: { message: string } }).error.message,
          FakeCheckText.WrongKind(Method.EventsSubscribe, SpecField.Subscriptions),
        );
        assert.equal(fake.subscriberCount(), 0);
      });
    }
  });

  test('the protocol and version options show in the pong', async () => {
    await withFake({ protocol: PROTOCOL + 1, version: '9.9.9-test' }, async (fake) => {
      const pong = await rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.Ping, {});
      assert.equal(pong.protocol, PROTOCOL + 1);
      assert.equal(pong.version, '9.9.9-test');
      assert.equal(WireField.Protocol in pong, true);
    });
  });
});
