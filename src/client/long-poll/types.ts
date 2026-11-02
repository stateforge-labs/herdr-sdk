// Role: CONTRACT of the long-poll helpers: the rpc timeout of a long-poll call and the bounds check before sending.
// Informs HERDR-ADR-0017 (locked seam; read-only for every lane), HERDR-ADR-0007 and plan 3.6 (LONG_POLL table from gen/overrides.ts).
import type { LONG_POLL, Method } from '../../generated/index.ts';

/** Methods whose rpc timeout follows a timeout_ms field in their params. */
export type LongPollMethod = keyof typeof LONG_POLL;

/**
 * The rpc timeout of one call: for a LongPollMethod whose timeout path is present, timeout_ms + Timeout.LongPollMarginMs;
 * otherwise `fallbackMs` (the client's timeoutMs). Pure. Implemented by client/long-poll/timeout.ts (P4a).
 * The namespace tree (P2b) calls it only for methods that are LONG_POLL keys.
 */
export type RequestTimeoutMs = (method: Method, params: unknown, fallbackMs: number | undefined) => number | undefined;

/**
 * Throws HerdrTransportError before sending when a bounded timeout is out of range (agent.start: > 3000 and <= 300000).
 * Pure. Implemented by client/long-poll/bounds.ts (P4a).
 */
export type AssertLongPollBounds = (method: Method, params: unknown) => void;
