// Role: checks rpc(): one answer per call, the typed errors, the timeout, abort, malformed and W3 replies, and the onCall hook.
// Informs HERDR-ADR-0016 (W1 one connection per request, W3 id "" accepted without a hang), HERDR-ADR-0004 (Promise core) and plan 3.1 and 3.3; ported from the hub herdr-client request cases and atalaya rpc-observer cases.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { CallOutcome, ErrorText, Fake, WireField } from '../../../src/constants.ts';
import { Method, ResultTag } from '../../../src/herdr/generated/index.ts';
import type { ResultOf } from '../../../src/herdr/wire/types.ts';
import type { CallEvent } from '../../../src/herdr/wire/call-hook.ts';
import { HerdrError, HerdrTransportError } from '../../../src/herdr/wire/errors.ts';
import { rpc } from '../../../src/herdr/wire/rpc.ts';
import { withFake } from '../../support/fake.ts';
import { rejectionOf } from '../../support/rejection.ts';
import { waitUntil } from '../../support/wait.ts';
import { startRawServer } from './support/raw-server.ts';

const SHORT_MS = 150;
const WAIT_MS = 1000;
// A partial snapshot: these tests check transport, not the snapshot shape (fake.reply is typed per method since HERDR-ADR-0017).
const SNAPSHOT_RESULT = { [WireField.Type]: ResultTag.SessionSnapshot, snapshot: {} } as unknown as ResultOf<typeof Method.SessionSnapshot>;
const REFUSAL = { code: 'bad_target', message: 'no such pane' };
const UNPARSEABLE_REPLY = '{"id":"","error":{"code":"invalid_request","message":"unparseable request"}}';
const PONG_REPLY = { [WireField.Type]: ResultTag.Pong, [WireField.Protocol]: 22, [WireField.Version]: 'test' };

describe('rpc', () => {
  test('returns the canned result', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.SessionSnapshot, SNAPSHOT_RESULT);
      const result = await rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.SessionSnapshot, {});
      assert.deepEqual(result, SNAPSHOT_RESULT);
    });
  });

  test('an error envelope becomes a HerdrError with its code and method', async () => {
    await withFake({}, async (fake) => {
      fake.fail(Method.SessionSnapshot, REFUSAL);
      const error = await rejectionOf(rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.SessionSnapshot, {}));
      assert.ok(error instanceof HerdrError);
      assert.equal(error.code, REFUSAL.code);
      assert.equal(error.method, Method.SessionSnapshot);
    });
  });

  test('a silent method rejects with a timeout and the socket is destroyed', async () => {
    await withFake({}, async (fake) => {
      fake.silent(Method.SessionSnapshot);
      const error = await rejectionOf(rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.SessionSnapshot, {}));
      assert.ok(error instanceof HerdrTransportError);
      assert.equal(error.isTimeout, true);
      await waitUntil(() => fake.connectionCount() === 0, WAIT_MS);
    });
  });

  test('an abort mid-call rejects with an aborted error and closes the socket', async () => {
    await withFake({}, async (fake) => {
      fake.silent(Method.SessionSnapshot);
      const controller = new AbortController();
      const pending = rejectionOf(
        rpc({ socketPath: fake.path, timeoutMs: WAIT_MS, signal: controller.signal }, Method.SessionSnapshot, {}),
      );
      await waitUntil(() => fake.receivedMethods().length === 1, WAIT_MS);
      controller.abort();
      const error = await pending;
      assert.ok(error instanceof HerdrTransportError);
      assert.equal(error.message, ErrorText.Aborted(Method.SessionSnapshot));
      await waitUntil(() => fake.connectionCount() === 0, WAIT_MS);
    });
  });

  test('an already-aborted signal rejects before any connection is opened', async () => {
    await withFake({}, async (fake) => {
      const controller = new AbortController();
      controller.abort();
      const error = await rejectionOf(
        rpc({ socketPath: fake.path, timeoutMs: SHORT_MS, signal: controller.signal }, Method.Ping, {}),
      );
      assert.ok(error instanceof HerdrTransportError);
      assert.deepEqual(fake.receivedMethods(), []);
      assert.equal(fake.connectionCount(), 0);
    });
  });

  test('a reply that is not JSON, or not an object, rejects as unparseable', async () => {
    await withFake({}, async (fake) => {
      fake.rawReply(Method.Ping, 'not json');
      fake.rawReply(Method.SessionSnapshot, '[1,2]');
      const notJson = await rejectionOf(rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.Ping, {}));
      const notObject = await rejectionOf(
        rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.SessionSnapshot, {}),
      );
      assert.ok(notJson instanceof HerdrTransportError);
      assert.equal(notJson.message, ErrorText.Unparseable(Method.Ping));
      assert.ok(notObject instanceof HerdrTransportError);
      assert.equal(notObject.message, ErrorText.Unparseable(Method.SessionSnapshot));
    });
  });

  test('a socket path with nothing behind it rejects with a cannot-connect error', async () => {
    const dir = mkdtempSync(join(tmpdir(), Fake.DirPrefix));
    const path = join(dir, 'missing.sock');
    try {
      const error = await rejectionOf(rpc({ socketPath: path, timeoutMs: SHORT_MS }, Method.Ping, {}));
      assert.ok(error instanceof HerdrTransportError);
      assert.equal(error.message, ErrorText.CannotConnect(path));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a stray line with another id is ignored and an empty-id reply still resolves', async () => {
    await withFake({}, async (fake) => {
      const stray = `{"id":"someone-else","result":{"type":"stray"}}`;
      const matching = `{"id":"","result":${JSON.stringify(PONG_REPLY)}}`;
      fake.rawReply(Method.Ping, `${stray}\n${matching}`);
      const result = await rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.Ping, {});
      assert.deepEqual(result, PONG_REPLY);
    });
  });

  test('a stray line alone is ignored: the call does not resolve with its result', async () => {
    await withFake({}, async (fake) => {
      const stray = `{"id":"someone-else","result":{"type":"stray"}}`;
      fake.rawReply(Method.Ping, stray);
      // The fake closes after the raw line, so the only way out is the close: a call that accepted the stray would have resolved.
      const error = await rejectionOf(rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.Ping, {}));
      assert.ok(error instanceof HerdrTransportError);
      assert.equal(error.message, ErrorText.ClosedBeforeResponse(Method.Ping));
    });
  });

  test('W3: an error with the empty id rejects at once and does not hang', async () => {
    await withFake({}, async (fake) => {
      fake.rawReply(Method.Ping, UNPARSEABLE_REPLY);
      const started = performance.now();
      const error = await rejectionOf(rpc({ socketPath: fake.path, timeoutMs: WAIT_MS }, Method.Ping, {}));
      assert.ok(error instanceof HerdrError, 'expected a HerdrError, not a timeout');
      assert.ok(performance.now() - started < WAIT_MS, 'the call settled before the timeout');
    });
  });

  test('a server that closes without a reply rejects as closed before a response', async () => {
    await withFake({}, async (fake) => {
      fake.rawReply(Method.Ping, '');
      const error = await rejectionOf(rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.Ping, {}));
      assert.ok(error instanceof HerdrTransportError);
      assert.equal(error.message, ErrorText.ClosedBeforeResponse(Method.Ping));
    });
  });

  test('each call uses its own connection', async () => {
    await withFake({}, async (fake) => {
      await rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.Ping, {});
      await waitUntil(() => fake.connectionCount() === 0, WAIT_MS);
      await rpc({ socketPath: fake.path, timeoutMs: SHORT_MS }, Method.Ping, {});
      await waitUntil(() => fake.connectionCount() === 0, WAIT_MS);
      assert.equal(fake.receivedMethods().length, 2);
    });
  });

  // W1 at the rpc level: the server answers once and ends the connection, as herdr does. Two sequential calls must open two
  // connections, each carrying exactly one request; a reused connection would show one connection with two requests.
  test('two sequential calls open two connections, one request each (W1: no reuse)', async () => {
    const requestsPerConnection: number[] = [];
    const server = await startRawServer((socket) => {
      const index = requestsPerConnection.push(0) - 1;
      socket.setEncoding('utf8');
      socket.on('data', (chunk: string) => {
        requestsPerConnection[index] = (requestsPerConnection[index] ?? 0) + 1;
        const id = String((JSON.parse(chunk.trim()) as Record<string, unknown>)[WireField.Id]);
        socket.end(`${JSON.stringify({ [WireField.Id]: id, [WireField.Result]: PONG_REPLY })}\n`);
      });
    });
    try {
      await rpc({ socketPath: server.path, timeoutMs: WAIT_MS }, Method.Ping, {});
      await rpc({ socketPath: server.path, timeoutMs: WAIT_MS }, Method.Ping, {});
      assert.deepEqual(requestsPerConnection, [1, 1]);
    } finally {
      await server.close();
    }
  });

  test('two concurrent calls open two connections, one each', async () => {
    await withFake({}, async (fake) => {
      fake.silent(Method.SessionSnapshot);
      const first = rejectionOf(rpc({ socketPath: fake.path, timeoutMs: WAIT_MS }, Method.SessionSnapshot, {}));
      const second = rejectionOf(rpc({ socketPath: fake.path, timeoutMs: WAIT_MS }, Method.SessionSnapshot, {}));
      await waitUntil(() => fake.connectionCount() === 2, WAIT_MS);
      assert.equal(fake.receivedMethods().length, 2);
      assert.ok((await first) instanceof HerdrTransportError);
      assert.ok((await second) instanceof HerdrTransportError);
      await waitUntil(() => fake.connectionCount() === 0, WAIT_MS);
    });
  });

  test('a server that keeps the socket open after its answer: rpc still destroys it', async () => {
    let answeredId = '';
    let clientClosed = false;
    const server = await startRawServer((socket) => {
      socket.setEncoding('utf8');
      socket.on('data', (chunk: string) => {
        answeredId = String((JSON.parse(chunk.trim()) as Record<string, unknown>)[WireField.Id]);
        socket.write(`${JSON.stringify({ [WireField.Id]: answeredId, [WireField.Result]: PONG_REPLY })}\n`);
      });
      socket.on('close', () => {
        clientClosed = true;
      });
    });
    try {
      const result = await rpc({ socketPath: server.path, timeoutMs: WAIT_MS }, Method.Ping, {});
      assert.deepEqual(result, PONG_REPLY);
      await waitUntil(() => clientClosed, WAIT_MS);
      assert.ok(answeredId.length > 0, 'the server answered the request');
    } finally {
      await server.close();
    }
  });

  test('an empty-id error followed by EOF rejects once as a HerdrError, and onCall fires once', async () => {
    await withFake({}, async (fake) => {
      fake.rawReply(Method.Ping, UNPARSEABLE_REPLY);
      const events: CallEvent[] = [];
      const error = await rejectionOf(
        rpc({ socketPath: fake.path, timeoutMs: WAIT_MS, onCall: (event) => events.push(event) }, Method.Ping, {}),
      );
      assert.ok(error instanceof HerdrError, 'the EOF after the error must not replace it');
      await delay(20);
      assert.equal(events.length, 1);
      assert.equal(events[0]?.outcome, CallOutcome.Refused);
    });
  });

  test('onCall reports an answered call once with a duration', async () => {
    await withFake({}, async (fake) => {
      const events: CallEvent[] = [];
      await rpc({ socketPath: fake.path, timeoutMs: SHORT_MS, onCall: (event) => events.push(event) }, Method.Ping, {});
      assert.equal(events.length, 1);
      assert.equal(events[0]?.method, Method.Ping);
      assert.equal(events[0]?.outcome, CallOutcome.Answered);
      assert.ok((events[0]?.durationMs ?? -1) >= 0);
    });
  });

  test('onCall reports a refusal with its code', async () => {
    await withFake({}, async (fake) => {
      fake.fail(Method.SessionSnapshot, REFUSAL);
      const events: CallEvent[] = [];
      await rejectionOf(
        rpc({ socketPath: fake.path, timeoutMs: SHORT_MS, onCall: (event) => events.push(event) }, Method.SessionSnapshot, {}),
      );
      assert.equal(events.length, 1);
      assert.equal(events[0]?.outcome, CallOutcome.Refused);
      assert.equal(events[0]?.code, REFUSAL.code);
    });
  });

  test('onCall reports a timeout as a transport outcome, once', async () => {
    await withFake({}, async (fake) => {
      fake.silent(Method.SessionSnapshot);
      const events: CallEvent[] = [];
      await rejectionOf(
        rpc({ socketPath: fake.path, timeoutMs: SHORT_MS, onCall: (event) => events.push(event) }, Method.SessionSnapshot, {}),
      );
      assert.equal(events.length, 1);
      assert.equal(events[0]?.outcome, CallOutcome.Transport);
    });
  });

  test('a throwing onCall hook changes neither the result nor the error', async () => {
    await withFake({}, async (fake) => {
      const throwing = (): void => {
        throw new Error('observer failed');
      };
      const result = await rpc({ socketPath: fake.path, timeoutMs: SHORT_MS, onCall: throwing }, Method.Ping, {});
      assert.equal(result.type, ResultTag.Pong);
      fake.fail(Method.SessionSnapshot, REFUSAL);
      const error = await rejectionOf(
        rpc({ socketPath: fake.path, timeoutMs: SHORT_MS, onCall: throwing }, Method.SessionSnapshot, {}),
      );
      assert.ok(error instanceof HerdrError);
    });
  });
});
