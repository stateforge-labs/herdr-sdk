// Role: CONTRACT of the test kit: what a test may pass to createFakeHerdr and the FakeHerdr handle it gets back (2a minimum + 5a full API).
// Informs HERDR-ADR-0017 (locked seam; read-only for every lane), HERDR-ADR-0008 (test kit on node:net), HERDR-ADR-0016 (W1-W6 fake behaviours) and plan 5.
import type { WireFact } from '../constants.ts';
import type { ErrorBody, Method, PushFrame } from '../generated/index.ts';
import type { ServerCapabilities } from '../generated/results.ts';
import type { ResultOf } from '../wire/types.ts';

export interface FakeHerdrOptions {
  /** Protocol number the pong reports; default the library's PROTOCOL. */
  readonly protocol?: number | undefined;
  /** herdr version the pong reports (client.serverInfo.version); default Fake.Version. */
  readonly version?: string | undefined;
  /** Socket path to listen on; default a fresh temp directory the fake removes on stop. */
  readonly socketPath?: string | undefined;
  /** Capabilities the pong advertises. Undefined: DEFAULT_CAPABILITIES. Null: the pong omits the field. */
  readonly capabilities?: ServerCapabilities | null | undefined;
}

/** One request line the fake received, parsed. */
export interface ReceivedRequest {
  readonly id: string;
  readonly method: string;
  readonly params: unknown;
}

/** A scripted step of replySequence: a result, or an error envelope. */
export type FakeStep<M extends Method> = { readonly result: ResultOf<M> } | { readonly error: ErrorBody };

/** A push line with an `event` the library does not know (HERDR-ADR-0016 P3). */
export interface UnknownPush {
  readonly event: string;
  readonly data: unknown;
}

export interface FakeHerdr {
  /** Socket path to pass as connect({ socketPath }). */
  readonly path: string;
  /** Capabilities the pong advertises (after the option's default). */
  readonly capabilities: ServerCapabilities | null;
  /** Measured herdr wire facts this fake reproduces (W1-W6), each covered by a test in test/test-kit. */
  readonly reproduces: readonly WireFact[];

  // --- 2a minimum (implemented) ---
  /**
   * Answers every later call of `method` with a result envelope. For events.subscribe the ack is the answer (F2), so a reply alone is not used there;
   * use fail, silent, rawReply or replySequence to change a subscribe.
   */
  reply<M extends Method>(method: M, result: ResultOf<M>): void;
  /** Answers every later call of `method` with an error envelope. */
  fail(method: Method, error: ErrorBody): void;
  /**
   * Accepts `method` and never answers; the connection stays open until the client closes it.
   * Ack-timeout recipe: `silent(Method.EventsSubscribe)` then subscribe with a short `ackTimeoutMs`.
   */
  silent(method: Method): void;
  /** Writes `line` verbatim for `method`, then ends the connection. */
  rawReply(method: Method, line: string): void;
  /** Every request method received, in order, ping included. */
  receivedMethods(): readonly string[];
  /** Connections open right now. */
  connectionCount(): number;
  /** Closes the server, destroys open connections, removes the temp directory it made. */
  stop(): Promise<void>;

  // --- 5a full fake (P5a) ---
  /** Answers successive calls of `method` with these steps, then falls back to reply/default. */
  replySequence<M extends Method>(method: M, steps: readonly FakeStep<M>[]): void;
  /** Every request received, parsed, in order. */
  requests(): readonly ReceivedRequest[];
  /**
   * Writes one push line to every acked subscription whose specs match it: a frame goes to a subscription that
   * subscribed its type, and a per-pane frame only to the one whose spec has the frame's pane_id (W6). An UnknownPush
   * goes to every acked subscription (herdr may send kinds nobody asked for; P3).
   */
  push(frame: PushFrame | UnknownPush): void;
  /** Closes every subscription connection (the client sees SubscriptionEnded). */
  closeSubscribers(): void;
  /** Subscriptions that are acked and open right now. */
  subscriberCount(): number;
  /** Queues pushes until the returned release function runs (to test frames between ack and snapshot). */
  holdPushes(): () => void;
  /** The next subscribe ack is written in two chunks (framing test, W2). */
  splitAck(): void;
  /** The next subscribe ack is preceded by `line`, a line with another id (stray-line test, W2). */
  strayLine(line: string): void;
  /**
   * Connections that sent a class C (ENTRY_METHODS.held) request and are still open: the fake keeps such a
   * connection open after the reply, as hold() assumes (contracts.md open issue 1).
   */
  heldCount(): number;
  /** Closes every held connection from the server side (the client's HeldConnection.ended resolves). */
  closeHeld(): void;
}

/** createFakeHerdr(options). Implemented by test-kit/fake-herdr.ts (P2a minimum, P5a full). */
export type CreateFakeHerdr = (options?: FakeHerdrOptions) => Promise<FakeHerdr>;
