// Role: checks openDedicated(): request/ack by id, the W3 empty id then EOF, one request at a time, pushes in order, split and stray lines, malformed lines, server and client closes, nothing listening, and the ack timeout.
// Informs HERDR-ADR-0016 (W1 one connection per request, W2 ack then pushes without id, W3 id "" then EOF is an answer), HERDR-ADR-0007 and plan 3.1 and 3.6; new test against the push-server stand-in.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CallOutcome, ErrorText, WireField } from '../../../../src/constants.ts';
import { Method, ResultTag, type PushFrame } from '../../../../src/herdr/generated/index.ts';
import { HerdrError, HerdrTransportError } from '../../../../src/herdr/wire/errors.ts';
import { openDedicated } from '../../../../src/herdr/wire/dedicated.ts';
import type { CallEvent } from '../../../../src/herdr/wire/call-hook.ts';
import type { DedicatedConnection, DedicatedEnd } from '../../../../src/herdr/wire/types.ts';
import { rejectionOf } from '../../../support/rejection.ts';
import { waitUntil } from '../../../support/wait.ts';
import { agentStatusFrame } from './support/frames.ts';
import { startPushServer, type PushServer } from './support/push-server.ts';

const WAIT_MS = 1000;
const SHORT_MS = 150;
const PONG = { [WireField.Type]: ResultTag.Pong, [WireField.Protocol]: 22, [WireField.Version]: 'test' };
const ACK = { [WireField.Type]: ResultTag.SubscriptionStarted };
const EMPTY_ID_ERROR = { code: 'invalid_request', message: 'unparseable request' };
const REFUSAL = { code: 'invalid_params', message: 'pane_id is required' };

// Runs a test against its own push server and stops it afterwards.
async function withServer(handler: Parameters<typeof startPushServer>[0], run: (server: PushServer) => Promise<void>): Promise<void> {
  const server = await startPushServer(handler);
  try {
    await run(server);
  } finally {
    await server.stop();
  }
}

// Replies to each request with the same result, by its own id.
function replyWith(result: object): Parameters<typeof startPushServer>[0] {
  return (request, connection) => {
    connection.send({ [WireField.Id]: request.id, [WireField.Result]: result });
  };
}

function ended(connection: DedicatedConnection): Promise<DedicatedEnd> {
  return connection.ended;
}

describe('openDedicated', () => {
  test('a request is answered by the line with its id', async () => {
    await withServer(replyWith(PONG), async (server) => {
      const connection = await openDedicated({ socketPath: server.path });
      const result = await connection.request(Method.Ping, {});
      assert.deepEqual(result, PONG);
      connection.destroy();
    });
  });

  test('an error envelope with the request id rejects with HerdrError', async () => {
    await withServer(
      (request, connection) => {
        connection.send({ [WireField.Id]: request.id, [WireField.Error]: REFUSAL });
      },
      async (server) => {
        const connection = await openDedicated({ socketPath: server.path });
        const error = await rejectionOf(connection.request(Method.EventsSubscribe, { subscriptions: [] }));
        assert.ok(error instanceof HerdrError);
        assert.equal(error.code, REFUSAL.code);
        assert.equal(error.method, Method.EventsSubscribe);
        connection.destroy();
      },
    );
  });

  test('an error with the empty id followed by EOF is the answer (W3)', async () => {
    await withServer(
      (_request, connection) => {
        connection.send({ [WireField.Id]: '', [WireField.Error]: EMPTY_ID_ERROR });
        connection.close();
      },
      async (server) => {
        const connection = await openDedicated({ socketPath: server.path });
        const error = await rejectionOf(connection.request(Method.Ping, {}));
        assert.ok(error instanceof HerdrError);
        assert.equal(error.code, EMPTY_ID_ERROR.code);
        const end = await ended(connection);
        assert.deepEqual(end, { byServer: true });
      },
    );
  });

  test('a second request while one is pending rejects; the first still resolves', async () => {
    await withServer(
      (request, connection) => {
        setTimeout(() => {
          connection.send({ [WireField.Id]: request.id, [WireField.Result]: PONG });
        }, 20);
      },
      async (server) => {
        const connection = await openDedicated({ socketPath: server.path });
        const first = connection.request(Method.Ping, {});
        const second = await rejectionOf(connection.request(Method.Ping, {}));
        assert.ok(second instanceof HerdrTransportError);
        assert.deepEqual(await first, PONG);
        connection.destroy();
      },
    );
  });

  test('pushes (lines without an id) reach the listener in arrival order', async () => {
    const frames: PushFrame[] = [agentStatusFrame('working'), agentStatusFrame('blocked'), agentStatusFrame('done')];
    await withServer(
      (request, connection) => {
        connection.send({ [WireField.Id]: request.id, [WireField.Result]: ACK });
        for (const frame of frames) connection.send(frame);
      },
      async (server) => {
        const connection = await openDedicated({ socketPath: server.path });
        const received: object[] = [];
        connection.onPush((line) => {
          received.push(line);
        });
        await connection.request(Method.EventsSubscribe, { subscriptions: [] });
        await waitUntil(() => received.length === frames.length, WAIT_MS);
        assert.deepEqual(received, frames);
        connection.destroy();
      },
    );
  });

  test('an ack written in two chunks is still one answer', async () => {
    await withServer(
      async (request, connection) => {
        const line = JSON.stringify({ [WireField.Id]: request.id, [WireField.Result]: ACK });
        const cut = Math.floor(line.length / 2);
        connection.writeRaw(line.slice(0, cut));
        await new Promise((resolve) => setTimeout(resolve, 10));
        connection.writeRaw(`${line.slice(cut)}\n`);
      },
      async (server) => {
        const connection = await openDedicated({ socketPath: server.path });
        assert.deepEqual(await connection.request(Method.EventsSubscribe, { subscriptions: [] }), ACK);
        connection.destroy();
      },
    );
  });

  test('a stray reply with another id is ignored', async () => {
    await withServer(
      (request, connection) => {
        connection.send({ [WireField.Id]: 'someone-else', [WireField.Result]: PONG });
        connection.send({ [WireField.Id]: request.id, [WireField.Result]: PONG });
      },
      async (server) => {
        const connection = await openDedicated({ socketPath: server.path });
        assert.deepEqual(await connection.request(Method.Ping, {}), PONG);
        connection.destroy();
      },
    );
  });

  test('a malformed line after the ack ends the connection with a transport cause', async () => {
    await withServer(
      (request, connection) => {
        connection.send({ [WireField.Id]: request.id, [WireField.Result]: ACK });
        connection.writeRaw('not json\n');
      },
      async (server) => {
        const connection = await openDedicated({ socketPath: server.path });
        await connection.request(Method.EventsSubscribe, { subscriptions: [] });
        const end = await ended(connection);
        assert.equal(end.byServer, false);
        assert.ok(end.cause instanceof HerdrTransportError);
      },
    );
  });

  test('a malformed reply while a request is pending rejects that request', async () => {
    await withServer(
      (_request, connection) => {
        connection.writeRaw('[1,2]\n');
      },
      async (server) => {
        const connection = await openDedicated({ socketPath: server.path });
        const error = await rejectionOf(connection.request(Method.Ping, {}));
        assert.ok(error instanceof HerdrTransportError);
      },
    );
  });

  test('a server close resolves ended with byServer true', async () => {
    await withServer(
      (request, connection) => {
        connection.send({ [WireField.Id]: request.id, [WireField.Result]: ACK });
        connection.close();
      },
      async (server) => {
        const connection = await openDedicated({ socketPath: server.path });
        await connection.request(Method.EventsSubscribe, { subscriptions: [] });
        assert.deepEqual(await ended(connection), { byServer: true });
      },
    );
  });

  test('destroy resolves ended with byServer false and is idempotent', async () => {
    await withServer(replyWith(ACK), async (server) => {
      const connection = await openDedicated({ socketPath: server.path });
      await connection.request(Method.EventsSubscribe, { subscriptions: [] });
      connection.destroy();
      connection.destroy();
      assert.deepEqual(await ended(connection), { byServer: false });
      const error = await rejectionOf(connection.request(Method.Ping, {}));
      assert.ok(error instanceof HerdrTransportError);
    });
  });

  test('an abort destroys the connection and resolves ended with byServer false', async () => {
    await withServer(replyWith(ACK), async (server) => {
      const controller = new AbortController();
      const connection = await openDedicated({ socketPath: server.path, signal: controller.signal });
      await connection.request(Method.EventsSubscribe, { subscriptions: [] });
      controller.abort();
      assert.deepEqual(await ended(connection), { byServer: false });
      await waitUntil(() => server.openConnections() === 0, WAIT_MS);
    });
  });

  test('nothing listening at the path rejects with HerdrTransportError', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'herdr-none-'));
    try {
      const error = await rejectionOf(openDedicated({ socketPath: join(dir, 'missing.sock') }));
      assert.ok(error instanceof HerdrTransportError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a request nobody answers rejects with a timeout HerdrTransportError', async () => {
    await withServer(
      () => undefined,
      async (server) => {
        const connection = await openDedicated({ socketPath: server.path });
        const error = await rejectionOf(connection.request(Method.Ping, {}, { timeoutMs: SHORT_MS }));
        assert.ok(error instanceof HerdrTransportError);
        assert.equal(error.isTimeout, true);
        assert.equal(error.message, ErrorText.NoResponse(Method.Ping, SHORT_MS));
        assert.deepEqual(await ended(connection), { byServer: false, cause: error });
      },
    );
  });

  test('onCall reports an answered request and a refused one', async () => {
    const events: CallEvent[] = [];
    await withServer(
      (request, connection) => {
        connection.send(
          request.method === Method.Ping
            ? { [WireField.Id]: request.id, [WireField.Result]: PONG }
            : { [WireField.Id]: request.id, [WireField.Error]: REFUSAL },
        );
      },
      async (server) => {
        const connection = await openDedicated({
          socketPath: server.path,
          onCall: (event) => {
            events.push(event);
          },
        });
        await connection.request(Method.Ping, {});
        await rejectionOf(connection.request(Method.EventsSubscribe, { subscriptions: [] }));
        assert.equal(events[0]?.outcome, CallOutcome.Answered);
        assert.equal(events[1]?.outcome, CallOutcome.Refused);
        assert.equal(events[1]?.code, REFUSAL.code);
        connection.destroy();
      },
    );
  });
});
