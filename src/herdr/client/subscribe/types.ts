// Role: CONTRACT of events.subscribe: the subscription handle (async iterator + close), its options and the factory the client composes.
// Informs HERDR-ADR-0017 (locked seam; read-only for every lane), HERDR-ADR-0007, HERDR-ADR-0016 (W2 ack then held stream, P3 UnknownFrame) and plan 3.6.
import type { Overflow } from '../../../constants.ts';
import type { Subscription } from '../../generated/index.ts';
import type { DecodedFrame, OnCall, OpenDedicated, UnknownFrame } from '../../wire/types.ts';

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
