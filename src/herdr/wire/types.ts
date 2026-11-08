// Role: CONTRACT of the wire layer (layer 1): the per-request rpc, the onCall timing hook, push-frame decoding and the dedicated connection that subscriptions and held connections own.
// Informs HERDR-ADR-0017 (locked seam; read-only for every lane), HERDR-ADR-0016 (W1 one request per connection, W2 ack then stream, events carry no id, W3 id "" then EOF is an answer, P3 unknown kinds), HERDR-ADR-0007 and plan 3.1.
import type { CallOutcome, UNKNOWN_EVENT } from '../../constants.ts';
import type { Method, PushFrame } from '../generated/index.ts';
import type { ParamsOf, ResultOf } from './typed.ts';

export type { ParamsOf, ResultOf } from './typed.ts';

/** One finished call, reported to the onCall hook (plan 3.3; atalaya RpcObserver). */
export interface CallEvent {
  readonly method: Method;
  readonly durationMs: number;
  readonly outcome: CallOutcome;
  /** The server's error code when outcome is Refused. */
  readonly code?: string;
}

/** Timing hook. A hook that throws never changes the call's result (wire/call-hook.ts reportCall). */
export type OnCall = (event: CallEvent) => void;

/** Options of one per-request call. */
export interface RpcOptions {
  readonly socketPath: string;
  /** No timeout when undefined. Long-poll callers pass timeout_ms + Timeout.LongPollMarginMs (plan 3.6). */
  readonly timeoutMs?: number | undefined;
  /** Abort destroys the connection and rejects with HerdrTransportError. */
  readonly signal?: AbortSignal | undefined;
  readonly onCall?: OnCall | undefined;
}

/**
 * One request on a fresh connection, destroyed on every exit path (W1). The reply is the first line whose id is the
 * request id or "" (W3). Rejects with HerdrError (server envelope) or HerdrTransportError (connect, timeout, abort,
 * malformed line, close before a reply). Implemented by wire/rpc.ts (P2a).
 */
export type Rpc = <M extends Method>(opts: RpcOptions, method: M, params: ParamsOf<M>) => Promise<ResultOf<M>>;

/** A push line whose `event` this library does not know: surfaced, never dropped, coerced or thrown (HERDR-ADR-0016 P3). */
export interface UnknownFrame {
  readonly event: typeof UNKNOWN_EVENT;
  /** The `event` value herdr sent. */
  readonly rawEvent: string;
  /** The whole parsed line. */
  readonly raw: object;
}

/** What a subscription yields: a known frame or an UnknownFrame. */
export type DecodedFrame = PushFrame | UnknownFrame;

/**
 * Turns one parsed push line (an object without `id`) into a frame. Validates the envelope only (P4): `event` must be a
 * string and `data` present; an unknown `event` gives UnknownFrame. Returns undefined for a line that is not a push
 * frame shape (the caller fails the subscription with HerdrTransportError). Implemented by wire/push-decoder.ts (P4a).
 */
export type DecodePush = (line: object) => DecodedFrame | undefined;

/** Options of a dedicated connection. */
export interface DedicatedOptions {
  readonly socketPath: string;
  readonly signal?: AbortSignal | undefined;
  readonly onCall?: OnCall | undefined;
}

/** Per-request options on a dedicated connection. */
export interface DedicatedRequestOptions {
  readonly timeoutMs?: number | undefined;
  readonly signal?: AbortSignal | undefined;
}

/**
 * One connection kept open on purpose: by a subscription (W2: ack, then a held stream) or by hold() for class C
 * methods. Requests are sent one at a time (no pipelining, W1); a line with an id answers the pending request, a line
 * without id is a push (W2). Implemented by wire/dedicated.ts (P4a); consumed by client/subscribe (P4a) and client/held (P4b).
 */
export interface DedicatedConnection {
  /** Sends one request and waits for the line with its id (or ""). Rejects if another request is still pending. */
  request<M extends Method>(method: M, params: ParamsOf<M>, options?: DedicatedRequestOptions): Promise<ResultOf<M>>;
  /** Every line without an id, parsed, in arrival order. Set once, before the first request. */
  onPush(listener: (line: object) => void): void;
  /** Resolves when the connection closes for any reason; the value says whether the server closed it. */
  readonly ended: Promise<DedicatedEnd>;
  /** Destroys the socket. Idempotent. */
  destroy(): void;
}

/** Why a dedicated connection ended. `byServer` false means destroy() or abort. */
export interface DedicatedEnd {
  readonly byServer: boolean;
  readonly cause?: unknown;
}

/** Opens a dedicated connection; rejects with HerdrTransportError when nothing listens at the path. */
export type OpenDedicated = (options: DedicatedOptions) => Promise<DedicatedConnection>;
