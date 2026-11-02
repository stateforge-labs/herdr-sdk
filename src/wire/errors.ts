// Role: the five error classes of the core: a server refusal, a transport failure, a protocol mismatch, a capability the server lacks, and an ended subscription. CONTRACT FILE (HERDR-ADR-0017): read-only for every lane.
// Informs HERDR-ADR-0003 (layers), HERDR-ADR-0016 (W3 error envelope) and plan 3.1 (error list); ported from atalaya src/protocol/error.ts plus two new classes.
import { ErrorName, ErrorText } from '../constants.ts';
import type { ErrorBody, Method, ServerCapability } from '../generated/index.ts';

// A server error envelope: the call reached herdr and herdr refused it.
export class HerdrError extends Error {
  override readonly name: string = ErrorName.Herdr;
  readonly code: string;
  readonly method: string;
  readonly body: ErrorBody;

  constructor(method: string, body: ErrorBody) {
    super(ErrorText.Refused(method, body.message, body.code));
    this.code = body.code;
    this.method = method;
    this.body = body;
  }

  static from(method: string, body: ErrorBody): HerdrError {
    return new HerdrError(method, body);
  }
}

export interface TransportErrorOptions {
  cause?: unknown;
  isTimeout?: boolean;
}

// The call never got a usable answer: connect, timeout, abort, socket or malformed line.
export class HerdrTransportError extends Error {
  override readonly name: string = ErrorName.Transport;
  readonly isTimeout: boolean;

  constructor(message: string, options: TransportErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.isTimeout = options.isTimeout ?? false;
  }
}

// The server speaks another protocol than the one this library was generated for.
export class ProtocolMismatchError extends Error {
  override readonly name: string = ErrorName.ProtocolMismatch;
  readonly expected: number;
  readonly actual: number;

  constructor(expected: number, actual: number) {
    super(ErrorText.ProtocolMismatch(expected, actual));
    this.expected = expected;
    this.actual = actual;
  }
}

// A method needs a server capability that the server did not advertise; nothing was sent.
export class UnsupportedByServerError extends Error {
  override readonly name: string = ErrorName.UnsupportedByServer;
  readonly method: Method;
  readonly capability: ServerCapability;

  constructor(method: Method, capability: ServerCapability) {
    super(ErrorText.Unsupported(method, capability));
    this.method = method;
    this.capability = capability;
  }
}

// The server closed a subscription connection (or it failed after the ack). Mapped to HerdrUnavailable in /effect (plan 3.7).
export class SubscriptionEnded extends Error {
  override readonly name: string = ErrorName.SubscriptionEnded;
  readonly method: Method;

  constructor(method: Method, options: { cause?: unknown } = {}) {
    super(ErrorText.SubscriptionEnded(method), { cause: options.cause });
    this.method = method;
  }
}
