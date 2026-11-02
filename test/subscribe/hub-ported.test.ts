// Role: the subscribe cases of the hub's herdr client, rewritten against createSubscribe() over openDedicated() and a push-server stand-in on a real socket.
// Informs HERDR-ADR-0016 (W1 close after a reply, W2 ack then id-less pushes, W3, W6), HERDR-ADR-0008 (fakes only) and plan Appendix A ("subscribe -> 4a" cases); ported from plugins/crisap94.voice-engine/hub/test/shared/herdr-client.test.ts.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ErrorText, WireField } from '../../src/constants.ts';
import { AgentStatus, Method, ResultTag, type PushFrame, type Subscription } from '../../src/generated/index.ts';
import { createSubscribe } from '../../src/client/subscribe/subscribe.ts';
import type { EventSubscription, SubscribeDeps } from '../../src/client/subscribe/types.ts';
import { HerdrError, HerdrTransportError, SubscriptionEnded } from '../../src/wire/errors.ts';
import { openDedicated } from '../../src/wire/dedicated.ts';
import type { DecodedFrame } from '../../src/wire/types.ts';
import { rejectionOf } from '../support/rejection.ts';
import { waitUntil } from '../support/wait.ts';
import { agentStatusFrame } from './support/frames.ts';
import { startPushServer, type PushServer, type ReceivedRequest, type RequestHandler, type ServerConnection } from './support/push-server.ts';

const WAIT_MS = 1000;
const SHORT_MS = 150;
const CLIENT_TIMEOUT_MS = 2000;
const PANE_SUBSCRIPTION: readonly Subscription[] = [{ type: 'pane.agent_status_changed', pane_id: 'p1' }];
const ACK = { [WireField.Type]: ResultTag.SubscriptionStarted };
const REFUSAL = { code: 'invalid_params', message: 'pane_id is required for this subscription type' };
const MALFORMED_REPLIES = ['not json\n', '[1,2]\n', '{"id":"x"\n'];
const MALFORMED_PUSHES = ['not json\n', '{"event":7,"data":{}}\n'];

// Runs a subscription scenario against its own push server, and the real client deps over the socket.
async function withServer(handler: RequestHandler, run: (server: PushServer, deps: (path: string) => SubscribeDeps) => Promise<void>): Promise<void> {
  const server = await startPushServer(handler);
  try {
    await run(server, (socketPath) => ({
      socketPath,
      timeoutMs: CLIENT_TIMEOUT_MS,
      signal: new AbortController().signal,
      open: openDedicated,
    }));
  } finally {
    await server.stop();
  }
}

// Acks each subscribe, then sends the frames the scenario lists.
function ackThen(...frames: PushFrame[]): RequestHandler {
  return (request, connection) => {
    connection.send({ [WireField.Id]: request.id, [WireField.Result]: ACK });
    for (const frame of frames) connection.send(frame);
  };
}

async function collect(subscription: EventSubscription, count: number): Promise<DecodedFrame[]> {
  const frames: DecodedFrame[] = [];
  for await (const frame of subscription) {
    frames.push(frame);
    if (frames.length === count) break;
  }
  return frames;
}

describe('subscribe over a socket (hub cases)', () => {
  test('delivers pushed frames in order after the ack', async () => {
    await withServer(ackThen(agentStatusFrame(AgentStatus.Working), agentStatusFrame(AgentStatus.Blocked)), async (server, deps) => {
      const subscription = await createSubscribe(deps(server.path))(PANE_SUBSCRIPTION);
      assert.deepEqual(await collect(subscription, 2), [agentStatusFrame(AgentStatus.Working), agentStatusFrame(AgentStatus.Blocked)]);
    });
  });

  test('closing the server side fails the stream with SubscriptionEnded', async () => {
    await withServer(
      (request, connection: ServerConnection) => {
        connection.send({ [WireField.Id]: request.id, [WireField.Result]: ACK });
        connection.send(agentStatusFrame(AgentStatus.Working));
        connection.close();
      },
      async (server, deps) => {
        const subscription = await createSubscribe(deps(server.path))(PANE_SUBSCRIPTION);
        const iterator = subscription[Symbol.asyncIterator]();
        assert.deepEqual((await iterator.next()).value, agentStatusFrame(AgentStatus.Working));
        const error = await rejectionOf(iterator.next());
        assert.ok(error instanceof SubscriptionEnded);
      },
    );
  });

  test('an events.subscribe error envelope becomes a HerdrError for events.subscribe', async () => {
    await withServer(
      (request, connection) => {
        connection.send({ [WireField.Id]: request.id, [WireField.Error]: REFUSAL });
        connection.close();
      },
      async (server, deps) => {
        const error = await rejectionOf(createSubscribe(deps(server.path))(PANE_SUBSCRIPTION));
        assert.ok(error instanceof HerdrError);
        assert.equal(error.method, Method.EventsSubscribe);
        assert.equal(error.code, REFUSAL.code);
      },
    );
  });

  test('subscribing to a socket that does not exist fails with HerdrTransportError', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'herdr-none-'));
    try {
      const deps: SubscribeDeps = { socketPath: join(dir, 'missing.sock'), timeoutMs: SHORT_MS, signal: new AbortController().signal, open: openDedicated };
      const error = await rejectionOf(createSubscribe(deps)(PANE_SUBSCRIPTION));
      assert.ok(error instanceof HerdrTransportError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a subscribe the server never acks fails after the ack timeout and closes the connection', async () => {
    await withServer(
      () => undefined,
      async (server, deps) => {
        const error = await rejectionOf(createSubscribe(deps(server.path))(PANE_SUBSCRIPTION, { ackTimeoutMs: SHORT_MS }));
        assert.ok(error instanceof HerdrTransportError);
        assert.equal(error.isTimeout, true);
        assert.equal(error.message, ErrorText.NoResponse(Method.EventsSubscribe, SHORT_MS));
        await waitUntil(() => server.openConnections() === 0, WAIT_MS);
      },
    );
  });

  test('each subscribe opens its own connection; a finished one is closed before the next starts', async () => {
    await withServer(ackThen(), async (server, deps) => {
      const client = createSubscribe(deps(server.path));
      const first = await client(PANE_SUBSCRIPTION);
      first.close();
      await waitUntil(() => server.openConnections() === 0, WAIT_MS);
      const second = await client([{ type: 'pane.agent_status_changed', pane_id: 'p2' }]);
      await waitUntil(() => server.openConnections() === 1, WAIT_MS);
      second.close();
      assert.equal(server.requests.filter((r: ReceivedRequest) => r.method === Method.EventsSubscribe).length, 2);
    });
  });

  test('closing the subscription early closes the server side of the connection', async () => {
    await withServer(ackThen(agentStatusFrame(AgentStatus.Working)), async (server, deps) => {
      const subscription = await createSubscribe(deps(server.path))(PANE_SUBSCRIPTION);
      const frames = await collect(subscription, 1);
      assert.equal(frames.length, 1);
      await waitUntil(() => server.openConnections() === 0, WAIT_MS);
    });
  });

  test('a stray reply with another id before the ack is ignored', async () => {
    await withServer(
      (request, connection) => {
        connection.send({ [WireField.Id]: 'someone-else', [WireField.Result]: ACK });
        connection.send({ [WireField.Id]: request.id, [WireField.Result]: ACK });
        connection.send(agentStatusFrame(AgentStatus.Working));
      },
      async (server, deps) => {
        const subscription = await createSubscribe(deps(server.path))(PANE_SUBSCRIPTION);
        assert.deepEqual(await collect(subscription, 1), [agentStatusFrame(AgentStatus.Working)]);
        subscription.close();
      },
    );
  });

  test('frames written apart from the ack are delivered in order', async () => {
    await withServer(
      async (request, connection) => {
        const ackLine = JSON.stringify({ [WireField.Id]: request.id, [WireField.Result]: ACK });
        connection.writeRaw(ackLine.slice(0, 10));
        await new Promise((resolve) => setTimeout(resolve, 10));
        connection.writeRaw(`${ackLine.slice(10)}\n`);
        connection.send(agentStatusFrame(AgentStatus.Working));
        connection.send(agentStatusFrame(AgentStatus.Blocked));
      },
      async (server, deps) => {
        const subscription = await createSubscribe(deps(server.path))(PANE_SUBSCRIPTION);
        assert.deepEqual(await collect(subscription, 2), [agentStatusFrame(AgentStatus.Working), agentStatusFrame(AgentStatus.Blocked)]);
        subscription.close();
      },
    );
  });

  for (const raw of MALFORMED_REPLIES) {
    test(`a subscribe reply ${JSON.stringify(raw)} that is not a JSON object fails with HerdrTransportError`, async () => {
      await withServer(
        (_request, connection) => {
          connection.writeRaw(raw);
        },
        async (server, deps) => {
          const error = await rejectionOf(createSubscribe(deps(server.path))(PANE_SUBSCRIPTION));
          assert.ok(error instanceof HerdrTransportError);
        },
      );
    });
  }

  for (const raw of MALFORMED_PUSHES) {
    test(`a line after the ack, ${JSON.stringify(raw)}, fails the stream with HerdrTransportError`, async () => {
      await withServer(
        (request, connection) => {
          connection.send({ [WireField.Id]: request.id, [WireField.Result]: ACK });
          connection.send(agentStatusFrame(AgentStatus.Working));
          connection.writeRaw(raw);
        },
        async (server, deps) => {
          const subscription = await createSubscribe(deps(server.path))(PANE_SUBSCRIPTION);
          const iterator = subscription[Symbol.asyncIterator]();
          assert.deepEqual((await iterator.next()).value, agentStatusFrame(AgentStatus.Working));
          const error = await rejectionOf(iterator.next());
          assert.ok(error instanceof HerdrTransportError);
        },
      );
    });
  }

  test('the client close ends a live subscription without a server error', async () => {
    const clientClose = new AbortController();
    await withServer(ackThen(), async (server, deps) => {
      const subscription = await createSubscribe({ ...deps(server.path), signal: clientClose.signal })(PANE_SUBSCRIPTION);
      const pending = subscription[Symbol.asyncIterator]().next();
      clientClose.abort();
      assert.deepEqual(await pending, { value: undefined, done: true });
      await waitUntil(() => server.openConnections() === 0, WAIT_MS);
    });
  });
});
