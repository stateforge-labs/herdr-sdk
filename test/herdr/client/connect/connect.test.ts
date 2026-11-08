// Role: checks connect(): the protocol policy, the missing and silent socket, the capability gate, the close of a client, and onCall through the client.
// Informs HERDR-ADR-0004 (Promise core), HERDR-ADR-0009 (protocol-tied versioning), plan 3.1 (capabilities) and plan 3.3 (connect options); ported from the hub checkProtocol cases.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CallOutcome, ErrorText, Fake, ProtocolPolicy, Timeout, WireField } from '../../../../src/constants.ts';
import { connectCore as connect } from '../../../../src/herdr/client/connect.ts';
import { Method, PROTOCOL, ResultTag, ServerCapability } from '../../../../src/herdr/generated/index.ts';
import type { ResultOf } from '../../../../src/herdr/wire/types.ts';
import type { CallEvent } from '../../../../src/herdr/wire/codec.ts';
import { HerdrError, HerdrTransportError, ProtocolMismatchError, UnsupportedByServerError } from '../../../../src/herdr/errors.ts';
import { withFake } from '../../../support/fake.ts';
import { rejectionOf } from '../../../support/rejection.ts';

const SHORT_MS = 150;
const CLIENT_DEFAULT_MS = 5000;
const CALL_MS = 50;
const OLDER = PROTOCOL - 1;
const NEWER = PROTOCOL + 1;
// A partial snapshot: these tests check transport, not the snapshot shape (fake.reply is typed per method since HERDR-ADR-0017).
const SNAPSHOT_RESULT = { [WireField.Type]: ResultTag.SessionSnapshot, snapshot: {} } as unknown as ResultOf<typeof Method.SessionSnapshot>;
const REFUSAL = { code: 'bad_target', message: 'no such pane' };

describe('connect', () => {
  test('connects to a current server and reports its protocol, version and capabilities', async () => {
    await withFake({}, async (fake) => {
      const client = await connect({ socketPath: fake.path, timeoutMs: SHORT_MS });
      assert.equal(client.serverInfo.protocol, PROTOCOL);
      assert.equal(client.serverInfo.version, Fake.Version);
      assert.equal(client.capabilities.live_handoff, true);
      client.close();
    });
  });

  test('an older protocol fails with a mismatch under the exact policy', async () => {
    await withFake({ protocol: OLDER }, async (fake) => {
      const error = await rejectionOf(connect({ socketPath: fake.path, timeoutMs: SHORT_MS }));
      assert.ok(error instanceof ProtocolMismatchError);
      assert.equal(error.expected, PROTOCOL);
      assert.equal(error.actual, OLDER);
    });
  });

  test('under the minimum policy a newer server connects and an older one fails', async () => {
    await withFake({ protocol: NEWER }, async (fake) => {
      const client = await connect({
        socketPath: fake.path,
        timeoutMs: SHORT_MS,
        protocolPolicy: ProtocolPolicy.Minimum,
      });
      assert.equal(client.serverInfo.protocol, NEWER);
      client.close();
    });
    await withFake({ protocol: OLDER }, async (fake) => {
      const error = await rejectionOf(
        connect({ socketPath: fake.path, timeoutMs: SHORT_MS, protocolPolicy: ProtocolPolicy.Minimum }),
      );
      assert.ok(error instanceof ProtocolMismatchError);
    });
  });

  test('a missing socket fails with a no-socket error before any connection', async () => {
    const dir = mkdtempSync(join(tmpdir(), Fake.DirPrefix));
    const path = join(dir, 'missing.sock');
    try {
      const error = await rejectionOf(connect({ socketPath: path, timeoutMs: SHORT_MS }));
      assert.ok(error instanceof HerdrTransportError);
      assert.equal(error.message, ErrorText.NoSocket(path));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a ping that is never answered fails with a timeout', async () => {
    await withFake({}, async (fake) => {
      fake.silent(Method.Ping);
      const error = await rejectionOf(connect({ socketPath: fake.path, timeoutMs: SHORT_MS }));
      assert.ok(error instanceof HerdrTransportError);
      assert.equal(error.isTimeout, true);
    });
  });

  test('a gated method on a server without its capability is refused before anything is sent', async () => {
    await withFake({ capabilities: { live_handoff: false } }, async (fake) => {
      const client = await connect({ socketPath: fake.path, timeoutMs: SHORT_MS });
      const error = await rejectionOf(client.call(Method.ServerLiveHandoff, {}));
      assert.ok(error instanceof UnsupportedByServerError);
      assert.equal(error.method, Method.ServerLiveHandoff);
      assert.equal(error.capability, ServerCapability.LiveHandoff);
      assert.deepEqual(fake.receivedMethods(), [Method.Ping]);
      client.close();
    });
  });

  test('a gated method on a server with its capability is sent', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.ServerLiveHandoff, null as unknown as ResultOf<typeof Method.ServerLiveHandoff>);
      const client = await connect({ socketPath: fake.path, timeoutMs: SHORT_MS });
      const result = await client.call(Method.ServerLiveHandoff, {});
      assert.equal(result, null);
      assert.ok(fake.receivedMethods().includes(Method.ServerLiveHandoff));
      client.close();
    });
  });

  test('call passes results and refusals through, and onCall sees the ping and each call', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.SessionSnapshot, SNAPSHOT_RESULT);
      fake.fail(Method.PaneGet, REFUSAL);
      const events: CallEvent[] = [];
      const client = await connect({
        socketPath: fake.path,
        timeoutMs: SHORT_MS,
        onCall: (event) => events.push(event),
      });
      assert.deepEqual(await client.call(Method.SessionSnapshot, {}), SNAPSHOT_RESULT);
      const error = await rejectionOf(client.call(Method.PaneGet, { pane_id: 'p1' }));
      assert.ok(error instanceof HerdrError);
      assert.deepEqual(
        events.map((event) => [event.method, event.outcome]),
        [
          [Method.Ping, CallOutcome.Answered],
          [Method.SessionSnapshot, CallOutcome.Answered],
          [Method.PaneGet, CallOutcome.Refused],
        ],
      );
      client.close();
    });
  });

  test('a per-call timeoutMs overrides the client default', async () => {
    await withFake({}, async (fake) => {
      fake.silent(Method.SessionSnapshot);
      const client = await connect({ socketPath: fake.path, timeoutMs: CLIENT_DEFAULT_MS });
      const started = performance.now();
      const error = await rejectionOf(client.call(Method.SessionSnapshot, {}, { timeoutMs: CALL_MS }));
      assert.ok(error instanceof HerdrTransportError);
      assert.equal(error.isTimeout, true);
      assert.ok(performance.now() - started < CLIENT_DEFAULT_MS, 'the call used its own timeout, not the client default');
      client.close();
    });
  });

  test('serverInfo.version is the version the pong reports', async () => {
    await withFake({ version: '0.0.0-test' }, async (fake) => {
      const client = await connect({ socketPath: fake.path, timeoutMs: SHORT_MS });
      assert.equal(client.serverInfo.version, '0.0.0-test');
      client.close();
    });
  });

  test('the transport carries the resolved settings and close() aborts its closed signal', async () => {
    await withFake({}, async (fake) => {
      const client = await connect({ socketPath: fake.path });
      assert.equal(client.transport.socketPath, fake.path);
      assert.equal(client.transport.timeoutMs, Timeout.DefaultMs);
      assert.equal(client.transport.closed.aborted, false);
      client.close();
      assert.equal(client.transport.closed.aborted, true);
    });
  });

  test('a closed client refuses a call without contacting the server', async () => {
    await withFake({}, async (fake) => {
      const client = await connect({ socketPath: fake.path, timeoutMs: SHORT_MS });
      const before = fake.receivedMethods().length;
      client.close();
      const error = await rejectionOf(client.call(Method.SessionSnapshot, {}));
      assert.ok(error instanceof HerdrTransportError);
      assert.equal(error.message, ErrorText.ClientClosed(Method.SessionSnapshot));
      assert.equal(fake.receivedMethods().length, before);
    });
  });
});
