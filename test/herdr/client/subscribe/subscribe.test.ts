// Role: checks createSubscribe() against an in-memory dedicated connection: the request and ack, the ack errors and timeouts, frames before the first read, unknown-frame hooks, every close source, server and malformed ends, and the queue overflow rules.
// Informs HERDR-ADR-0007, HERDR-ADR-0016 (W2 ack then stream, P3 unknown kinds yielded, W6 invalid_params) and plan 3.6 (queue, close, ackTimeoutMs); new test.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Overflow, UNKNOWN_EVENT, WireField } from '../../../../src/constants.ts';
import { Method, ResultTag, type Subscription } from '../../../../src/herdr/generated/index.ts';
import { createSubscribe } from '../../../../src/herdr/client/subscribe/subscribe.ts';
import type { SubscribeDeps, SubscribeOptions, EventSubscription } from '../../../../src/herdr/client/subscribe/types.ts';
import { HerdrError, HerdrTransportError, SubscriptionEnded } from '../../../../src/herdr/wire/errors.ts';
import type { DecodedFrame, UnknownFrame } from '../../../../src/herdr/wire/types.ts';
import { rejectionOf } from '../../../support/rejection.ts';
import { waitUntil } from '../../../support/wait.ts';
import { agentStatusFrame, unknownKindLine } from './support/frames.ts';
import { createInMemoryDedicated, type InMemoryDedicated } from './support/in-memory-dedicated.ts';

const WAIT_MS = 1000;
const CLIENT_TIMEOUT_MS = 1234;
const SOCKET = '/unused/herdr.sock';
const ACK = { [WireField.Type]: ResultTag.SubscriptionStarted };
const SPECS: readonly Subscription[] = [{ type: 'pane.agent_status_changed', pane_id: 'p1' }];
const REFUSAL = { code: 'invalid_params', message: 'pane_id is required' };

interface Harness {
  readonly stub: InMemoryDedicated;
  readonly deps: SubscribeDeps;
  readonly clientClose: AbortController;
}

function harness(overrides: Partial<SubscribeDeps> = {}): Harness {
  const stub = createInMemoryDedicated();
  const clientClose = new AbortController();
  const deps: SubscribeDeps = {
    socketPath: SOCKET,
    timeoutMs: CLIENT_TIMEOUT_MS,
    signal: clientClose.signal,
    open: stub.open,
    ...overrides,
  };
  return { stub, deps, clientClose };
}

// Opens a subscription and waits until its request reached the connection.
async function subscribeAndAck(h: Harness, options?: SubscribeOptions): Promise<EventSubscription> {
  const pending = createSubscribe(h.deps)(SPECS, options);
  await waitUntil(() => h.stub.requests.length === 1, WAIT_MS);
  h.stub.reply(ACK);
  return pending;
}

async function nextOf(subscription: EventSubscription): Promise<IteratorResult<DecodedFrame>> {
  return subscription[Symbol.asyncIterator]().next();
}

describe('createSubscribe', () => {
  test('building the function never throws and sends nothing', () => {
    const h = harness();
    assert.equal(typeof createSubscribe(h.deps), 'function');
    assert.equal(h.stub.requests.length, 0);
  });

  test('sends events.subscribe with the specs on the connection it opened', async () => {
    const h = harness();
    const pending = subscribeAndAck(h);
    await pending;
    assert.equal(h.stub.openedWith[0]?.socketPath, SOCKET);
    assert.equal(h.stub.requests[0]?.method, Method.EventsSubscribe);
    assert.deepEqual(h.stub.requests[0]?.params, { subscriptions: SPECS });
  });

  test('resolves only after the subscription_started ack', async () => {
    const h = harness();
    let resolved = false;
    const pending = createSubscribe(h.deps)(SPECS).then((subscription) => {
      resolved = true;
      return subscription;
    });
    await waitUntil(() => h.stub.requests.length === 1, WAIT_MS);
    assert.equal(resolved, false);
    h.stub.reply(ACK);
    await pending;
    assert.equal(resolved, true);
  });

  test('an ack error rejects with the HerdrError and destroys the connection', async () => {
    const h = harness();
    const pending = createSubscribe(h.deps)(SPECS);
    await waitUntil(() => h.stub.requests.length === 1, WAIT_MS);
    h.stub.rejectRequest(new HerdrError(Method.EventsSubscribe, REFUSAL));
    const error = await rejectionOf(pending);
    assert.ok(error instanceof HerdrError);
    assert.equal(error.method, Method.EventsSubscribe);
    assert.equal(h.stub.destroyed, true);
  });

  test('the ack timeout defaults to the client timeout, and ackTimeoutMs overrides it', async () => {
    const h = harness();
    void createSubscribe(h.deps)(SPECS);
    await waitUntil(() => h.stub.requests.length === 1, WAIT_MS);
    assert.equal(h.stub.requests[0]?.options?.timeoutMs, CLIENT_TIMEOUT_MS);

    const other = harness();
    void createSubscribe(other.deps)(SPECS, { ackTimeoutMs: 50 });
    await waitUntil(() => other.stub.requests.length === 1, WAIT_MS);
    assert.equal(other.stub.requests[0]?.options?.timeoutMs, 50);
  });

  test('frames that arrive before the first read are kept, in order', async () => {
    const h = harness();
    const subscription = await subscribeAndAck(h);
    h.stub.pushLine(agentStatusFrame('working'));
    h.stub.pushLine(agentStatusFrame('blocked'));
    assert.deepEqual(await nextOf(subscription), { value: agentStatusFrame('working'), done: false });
    assert.deepEqual(await nextOf(subscription), { value: agentStatusFrame('blocked'), done: false });
    subscription.close();
  });

  test('an unknown kind reaches the client hook, then the per-call hook, then the stream', async () => {
    const calls: string[] = [];
    const seen: UnknownFrame[] = [];
    const h = harness({
      onUnknown: (frame) => {
        calls.push('client');
        seen.push(frame);
      },
    });
    const subscription = await subscribeAndAck(h, {
      onUnknown: (frame) => {
        calls.push('call');
        seen.push(frame);
      },
    });
    h.stub.pushLine(unknownKindLine('future_kind'));
    const result = await nextOf(subscription);
    assert.deepEqual(calls, ['client', 'call']);
    assert.equal(result.done, false);
    const frame = result.value as UnknownFrame;
    assert.equal(frame.event, UNKNOWN_EVENT);
    assert.equal(frame.rawEvent, 'future_kind');
    assert.equal(seen[0], frame);
    subscription.close();
  });

  test('a throwing hook does not break the stream', async () => {
    const h = harness({
      onUnknown: () => {
        throw new Error('client hook');
      },
    });
    const subscription = await subscribeAndAck(h, {
      onUnknown: () => {
        throw new Error('call hook');
      },
    });
    h.stub.pushLine(unknownKindLine());
    const result = await nextOf(subscription);
    assert.equal((result.value as UnknownFrame).event, UNKNOWN_EVENT);
    subscription.close();
  });

  test('a server close ends the iteration with SubscriptionEnded', async () => {
    const h = harness();
    const subscription = await subscribeAndAck(h);
    h.stub.serverClose();
    const error = await rejectionOf(nextOf(subscription));
    assert.ok(error instanceof SubscriptionEnded);
  });

  test('a cause on the connection end is thrown as that HerdrTransportError', async () => {
    const h = harness();
    const subscription = await subscribeAndAck(h);
    const cause = new HerdrTransportError('socket went away');
    h.stub.fail(cause);
    assert.equal(await rejectionOf(nextOf(subscription)), cause);
  });

  test('a malformed push line fails the iteration with HerdrTransportError and destroys the connection', async () => {
    const h = harness();
    const subscription = await subscribeAndAck(h);
    h.stub.pushLine({ event: 5, data: {} });
    const error = await rejectionOf(nextOf(subscription));
    assert.ok(error instanceof HerdrTransportError);
    assert.equal(h.stub.destroyed, true);
  });

  test('close() ends the iteration normally and destroys the connection', async () => {
    const h = harness();
    const subscription = await subscribeAndAck(h);
    const pending = nextOf(subscription);
    subscription.close();
    assert.deepEqual(await pending, { value: undefined, done: true });
    assert.equal(h.stub.destroyed, true);
  });

  test('an abort of the caller signal ends the iteration normally and destroys the connection', async () => {
    const h = harness();
    const controller = new AbortController();
    const subscription = await subscribeAndAck(h, { signal: controller.signal });
    const pending = nextOf(subscription);
    controller.abort();
    assert.deepEqual(await pending, { value: undefined, done: true });
    assert.equal(h.stub.destroyed, true);
  });

  test('the client close ends every subscription normally and destroys the connection', async () => {
    const h = harness();
    const subscription = await subscribeAndAck(h);
    const pending = nextOf(subscription);
    h.clientClose.abort();
    assert.deepEqual(await pending, { value: undefined, done: true });
    assert.equal(h.stub.destroyed, true);
  });

  test('the DropOldest queue keeps the newest frames', async () => {
    const h = harness();
    const subscription = await subscribeAndAck(h, { queue: { max: 2, overflow: Overflow.DropOldest } });
    h.stub.pushLine(agentStatusFrame('working'));
    h.stub.pushLine(agentStatusFrame('blocked'));
    h.stub.pushLine(agentStatusFrame('done'));
    const iterator = subscription[Symbol.asyncIterator]();
    assert.deepEqual((await iterator.next()).value, agentStatusFrame('blocked'));
    assert.deepEqual((await iterator.next()).value, agentStatusFrame('done'));
    subscription.close();
  });

  test('the Fail queue delivers what it has, then throws HerdrTransportError', async () => {
    const h = harness();
    const subscription = await subscribeAndAck(h, { queue: { max: 1, overflow: Overflow.Fail } });
    h.stub.pushLine(agentStatusFrame('working'));
    h.stub.pushLine(agentStatusFrame('blocked'));
    const iterator = subscription[Symbol.asyncIterator]();
    assert.deepEqual((await iterator.next()).value, agentStatusFrame('working'));
    const error = await rejectionOf(iterator.next());
    assert.ok(error instanceof HerdrTransportError);
    assert.equal(h.stub.destroyed, true);
  });
});
