// Role: subscriptions: one dedicated connection per subscribe, its frame queue, close signals and unknown-frame delivery.
// Informs HERDR-ADR-0017, HERDR-ADR-0007, HERDR-ADR-0016, plan 3.6; merged by HERDR-ADR-0021 from types.ts, constants.ts, close-signals.ts, deliver-unknown.ts, frame-queue.ts, subscription.ts, subscribe.ts.
import { Overflow, UNKNOWN_EVENT } from '../../constants.ts';
import type { Subscription } from '../generated/index.ts';
import type { DecodedFrame, OnCall, OpenDedicated, UnknownFrame, DedicatedConnection, DedicatedEnd } from '../wire/types.ts';
import { HerdrTransportError, SubscriptionEnded } from '../errors.ts';
import { MethodEventsSubscribe } from '../generated/names/method.ts';
import { decodePush } from '../wire/push-decoder.ts';

/** Bounded queue. Without it the queue is unbounded (plan 3.6). */
export interface QueueOptions {
  readonly max: number;
  /** DropOldest drops the oldest queued frame; Fail ends the iterator with HerdrTransportError. */
  readonly overflow: Overflow;
}

export interface SubscribeOptions {
  /** Abort closes the subscription (same as close()). */
  readonly signal?: AbortSignal | undefined;
  /** How long to wait for the `subscription_started` ack; default: the client's timeoutMs. */
  readonly ackTimeoutMs?: number | undefined;
  readonly queue?: QueueOptions | undefined;
  /** Called once per UnknownFrame, before it is yielded, after the client-level onUnknown (P3: counted, never dropped). */
  readonly onUnknown?: ((frame: UnknownFrame) => void) | undefined;
}

/**
 * A live subscription on its own connection. Iterating yields frames in arrival order. close() (or abort) ends the
 * iteration normally and destroys the connection. A server close ends it by throwing SubscriptionEnded; a malformed
 * line throws HerdrTransportError. No history is replayed: frames are changes, not the present (W5).
 */
export interface EventSubscription extends AsyncIterable<DecodedFrame> {
  close(): void;
}

/**
 * `herdr.events.subscribe(specs, options)`: opens a dedicated connection, sends `events.subscribe`, waits for the ack
 * (id-matched), then streams. Rejects with HerdrError on an error envelope (e.g. invalid_params for a per-pane type
 * without pane_id, W6), HerdrTransportError on connect/ack timeout.
 */
export type Subscribe = (specs: readonly Subscription[], options?: SubscribeOptions) => Promise<EventSubscription>;

/** What the client hands the subscribe factory. */
export interface SubscribeDeps {
  readonly socketPath: string;
  /** The client's resolved timeout (ClientTransport.timeoutMs); the ack timeout default. */
  readonly timeoutMs: number;
  readonly onCall?: OnCall | undefined;
  /** The client-level hook (ClientTransport.onUnknown); called before SubscribeOptions.onUnknown. */
  readonly onUnknown?: ((frame: UnknownFrame) => void) | undefined;
  /** The client close signal (ClientTransport.closed): when it aborts, every subscription of this client closes. */
  readonly signal: AbortSignal;
  /** Injected so tests can stub the connection (default wire/dedicated.ts openDedicated). */
  readonly open: OpenDedicated;
}

/** Builds the subscribe function of one client. Implemented by client/subscribe/subscribe.ts (P4a). */
export type CreateSubscribe = (deps: SubscribeDeps) => Subscribe;

export const SubscribeText = {
  MalformedPush: 'events.subscribe: malformed push line',
  QueueFull: (max: number): string => `subscription queue is full (max ${max})`,
} as const;

export interface CombinedSignal {
  readonly signal: AbortSignal;
  readonly dispose: () => void;
}

export function anySignal(...sources: (AbortSignal | undefined)[]): CombinedSignal {
  const controller = new AbortController();
  const attached = sources.filter(isAttached);
  const onAbort = (): void => {
    dispose();
    controller.abort();
  };
  const dispose = (): void => {
    for (const source of attached) {
      source.removeEventListener('abort', onAbort);
    }
  };
  for (const source of attached) {
    if (source.aborted) {
      onAbort();
      break;
    }
    source.addEventListener('abort', onAbort);
  }
  return { signal: controller.signal, dispose };
}

function isAttached(source: AbortSignal | undefined): source is AbortSignal {
  return source !== undefined;
}

export type UnknownHook = (frame: UnknownFrame) => void;

export function deliverUnknown(frame: UnknownFrame, hooks: readonly (UnknownHook | undefined)[]): void {
  for (const hook of hooks) {
    runHook(hook, frame);
  }
}

// Best effort, like reportCall: the observer's failure never reaches the consumer.
function runHook(hook: UnknownHook | undefined, frame: UnknownFrame): void {
  if (hook === undefined) {
    return;
  }
  try {
    hook(frame);
  } catch {
    // The hook is an observer; its exception is not the subscription's error.
  }
}

const END_OF_ITERATION: IteratorReturnResult<undefined> = { done: true, value: undefined };

interface Entry<T> {
  readonly value: T;
}

interface Waiter<T> {
  readonly resolve: (result: IteratorResult<T>) => void;
  readonly reject: (reason: unknown) => void;
}

interface Failure {
  readonly reason: unknown;
}

const NO_FAIL_HOOK = (): void => undefined;

export class FrameQueue<T> {
  private readonly items: Entry<T>[] = [];
  private readonly waiters: Waiter<T>[] = [];
  private readonly max: number | undefined;
  private readonly overflow: Overflow;
  private readonly onFail: () => void;
  private ended = false;
  private failure: Failure | undefined = undefined;

  // onFail runs once, when the queue fails, so the owner can release what feeds it (the connection).
  constructor(options: QueueOptions | undefined, onFail: () => void = NO_FAIL_HOOK) {
    this.max = options?.max;
    this.overflow = options?.overflow ?? Overflow.DropOldest;
    this.onFail = onFail;
  }

  // Hands the frame to a waiting next(), or queues it; a full queue fails (Fail) or drops its oldest frame (DropOldest).
  push(value: T): void {
    if (this.isClosed()) {
      return;
    }
    const waiter = this.waiters.shift();
    if (waiter !== undefined) {
      waiter.resolve({ value, done: false });
      return;
    }
    const max = this.max;
    if (max !== undefined && this.items.length >= max) {
      if (this.overflow === Overflow.Fail) {
        this.fail(new HerdrTransportError(SubscribeText.QueueFull(max)));
        return;
      }
      this.items.shift();
    }
    this.items.push({ value });
  }

  // The next queued frame; queued frames are read before an end or a failure is seen.
  next(): Promise<IteratorResult<T>> {
    const entry = this.items.shift();
    if (entry !== undefined) {
      return Promise.resolve<IteratorResult<T>>({ value: entry.value, done: false });
    }
    if (this.failure !== undefined) {
      return Promise.reject(this.failure.reason);
    }
    if (this.ended) {
      return Promise.resolve<IteratorResult<T>>(END_OF_ITERATION);
    }
    return new Promise<IteratorResult<T>>((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }

  // No more frames: the iteration finishes normally once the queued frames are read.
  end(): void {
    if (this.isClosed()) {
      return;
    }
    this.ended = true;
    for (const waiter of this.waiters.splice(0)) {
      waiter.resolve(END_OF_ITERATION);
    }
  }

  // The iteration throws `reason` once the queued frames are read; the owner is told once so it can release the feed.
  fail(reason: unknown): void {
    if (this.isClosed()) {
      return;
    }
    this.failure = { reason };
    for (const waiter of this.waiters.splice(0)) {
      waiter.reject(reason);
    }
    this.onFail();
  }

  private isClosed(): boolean {
    return this.ended || this.failure !== undefined;
  }
}

export function subscriptionOver(queue: FrameQueue<DecodedFrame>, close: () => void): EventSubscription {
  const iterator: AsyncIterator<DecodedFrame> = {
    next: () => queue.next(),
    return: async () => {
      close();
      return { done: true, value: undefined };
    },
  };
  return {
    close,
    [Symbol.asyncIterator]: () => iterator,
  };
}

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
      MethodEventsSubscribe,
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
    queue.fail(new SubscriptionEnded(MethodEventsSubscribe));
    return;
  }
  queue.end();
}

function isUnknownFrame(frame: DecodedFrame): frame is UnknownFrame {
  return frame.event === UNKNOWN_EVENT;
}
