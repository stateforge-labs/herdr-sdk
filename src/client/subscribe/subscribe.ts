// Role: events.subscribe over its own dedicated connection: open, register the push listener, send the request, wait for the id-matched ack, then stream until a close source ends it.
// Informs HERDR-ADR-0007, HERDR-ADR-0016 (W2 ack then stream, pushes carry no id, W6 invalid_params as a HerdrError) and plan 3.6; contract in client/subscribe/types.ts (CreateSubscribe).
import { UNKNOWN_EVENT } from '../../constants.ts';
import { Method, type Subscription } from '../../generated/index.ts';
import { HerdrTransportError, SubscriptionEnded } from '../../wire/errors.ts';
import { decodePush } from '../../wire/push-decoder.ts';
import type { DecodedFrame, DedicatedConnection, DedicatedEnd, UnknownFrame } from '../../wire/types.ts';
import { anySignal, type CombinedSignal } from './close-signals.ts';
import { SubscribeText } from './constants.ts';
import { deliverUnknown, type UnknownHook } from './deliver-unknown.ts';
import { FrameQueue } from './frame-queue.ts';
import { subscriptionOver } from './subscription.ts';
import type { CreateSubscribe, EventSubscription, SubscribeDeps, SubscribeOptions } from './types.ts';

// What the push listener writes to: the queue the caller reads (it releases the connection when it fails), and the unknown-frame hooks in call order.
interface Stream {
  readonly queue: FrameQueue<DecodedFrame>;
  readonly hooks: readonly (UnknownHook | undefined)[];
}

export const createSubscribe: CreateSubscribe = function createSubscribe(deps) {
  return function subscribe(specs, options = {}) {
    return openSubscription(deps, specs, options);
  };
};

async function openSubscription(
  deps: SubscribeDeps,
  specs: readonly Subscription[],
  options: SubscribeOptions,
): Promise<EventSubscription> {
  const scope = anySignal(deps.signal, options.signal);
  const connection = await openStream(deps, scope);
  const queue = new FrameQueue<DecodedFrame>(options.queue, () => {
    connection.destroy();
  });
  const stream: Stream = { queue, hooks: [deps.onUnknown, options.onUnknown] };
  connection.onPush((line) => {
    routePush(line, stream);
  });
  void connection.ended.then((end) => {
    settleEnd(end, queue, scope);
  });
  try {
    await connection.request(
      Method.EventsSubscribe,
      { subscriptions: [...specs] },
      { timeoutMs: options.ackTimeoutMs ?? deps.timeoutMs },
    );
  } catch (error) {
    connection.destroy();
    throw error;
  }
  return subscriptionOver(queue, () => {
    queue.end();
    connection.destroy();
  });
}

async function openStream(deps: SubscribeDeps, scope: CombinedSignal): Promise<DedicatedConnection> {
  try {
    return await deps.open({ socketPath: deps.socketPath, signal: scope.signal, onCall: deps.onCall });
  } catch (error) {
    scope.dispose();
    throw error;
  }
}

// A frame is decoded, offered to the unknown hooks when it is unknown, then queued. A line that is not a push fails the queue, which releases the connection.
function routePush(line: object, stream: Stream): void {
  const frame = decodePush(line);
  if (frame === undefined) {
    stream.queue.fail(new HerdrTransportError(SubscribeText.MalformedPush));
    return;
  }
  if (isUnknownFrame(frame)) {
    deliverUnknown(frame, stream.hooks);
  }
  stream.queue.push(frame);
}

// The connection ended: a server close is an error for the caller, a cause is that error, anything else (close, abort, client close) is a normal end.
function settleEnd(end: DedicatedEnd, queue: FrameQueue<DecodedFrame>, scope: CombinedSignal): void {
  scope.dispose();
  if (end.cause !== undefined) {
    queue.fail(end.cause);
    return;
  }
  if (end.byServer) {
    queue.fail(new SubscriptionEnded(Method.EventsSubscribe));
    return;
  }
  queue.end();
}

function isUnknownFrame(frame: DecodedFrame): frame is UnknownFrame {
  return frame.event === UNKNOWN_EVENT;
}
