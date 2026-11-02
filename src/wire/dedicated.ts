// Role: a connection kept open on purpose (a subscription, later a held connection): one request at a time, pushes handed to one listener, and one `ended` that says who closed it.
// Informs HERDR-ADR-0016 (W1 one request per connection, W2 ack then a held stream of id-less pushes, W3 an id "" reply then EOF is an answer), HERDR-ADR-0007 and plan 3.6; contract in wire/types.ts (OpenDedicated, DedicatedConnection).
import { CallOutcome, EMPTY_REPLY_ID, ErrorText, WireField } from '../constants.ts';
import type { Method } from '../generated/index.ts';
import { outcomeOf, reportCall } from './call-hook.ts';
import { Connection, type ConnectionHandlers } from './connection.ts';
import { HerdrError, HerdrTransportError } from './errors.ts';
import { encodeRequest, isErrorEnvelope, isObject } from './envelope.ts';
import { nextId } from './id.ts';
import type {
  DedicatedConnection,
  DedicatedEnd,
  DedicatedOptions,
  DedicatedRequestOptions,
  OnCall,
  OpenDedicated,
} from './types.ts';
import type { ParamsOf, ResultOf } from './typed.ts';

// Texts only this layer words (the shared constants file is read-only for lane P4a).
const DedicatedText = {
  Aborted: 'dedicated connection: aborted before it opened',
  Malformed: 'dedicated connection: unparseable line',
  SocketError: 'dedicated connection: socket error',
  RequestPending: (method: string): string => `${method}: another request is still pending on this connection`,
} as const;

const NO_CLEANUP = (): void => undefined;

// The request in flight (W1: at most one). Settled once; its timer and abort listener are released first.
interface Pending {
  readonly method: Method;
  readonly requestId: string;
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout> | undefined;
  detachAbort: () => void;
}

// The `ended` promise and the function that resolves it, kept together.
interface Ending {
  readonly ended: Promise<DedicatedEnd>;
  readonly settle: (end: DedicatedEnd) => void;
}

interface Session {
  readonly onCall: OnCall | undefined;
  readonly ending: Ending;
  connection: Connection | undefined;
  pending: Pending | undefined;
  pushListener: ((line: object) => void) | undefined;
  finished: boolean;
  detachSignal: () => void;
}

export const openDedicated: OpenDedicated = async function openDedicated(
  options: DedicatedOptions,
): Promise<DedicatedConnection> {
  if (options.signal?.aborted === true) {
    throw new HerdrTransportError(DedicatedText.Aborted);
  }
  const session = newSession(options.onCall);
  const connection = await Connection.open(options.socketPath, handlersFor(session));
  session.connection = connection;
  session.detachSignal = listenForAbort(options.signal, () => {
    finish(session, { byServer: false });
  });
  if (session.finished) {
    connection.destroy();
  }
  return connectionOf(session);
};

function newSession(onCall: OnCall | undefined): Session {
  return {
    onCall,
    ending: newEnding(),
    connection: undefined,
    pending: undefined,
    pushListener: undefined,
    finished: false,
    detachSignal: NO_CLEANUP,
  };
}

function newEnding(): Ending {
  let settle: (end: DedicatedEnd) => void = NO_CLEANUP;
  const ended = new Promise<DedicatedEnd>((resolve) => {
    settle = resolve;
  });
  return {
    ended,
    settle: (end) => {
      settle(end);
    },
  };
}

// Socket events feed the session: a line is routed, a server close ends it by server, a socket error ends it with a cause.
function handlersFor(session: Session): ConnectionHandlers {
  return {
    onLine: (line) => {
      routeLine(session, line);
    },
    onClose: () => {
      finish(session, { byServer: true });
    },
    onError: (error) => {
      finish(session, { byServer: false, cause: new HerdrTransportError(DedicatedText.SocketError, { cause: error }) });
    },
  };
}

function connectionOf(session: Session): DedicatedConnection {
  return {
    request: requestOn(session),
    onPush: (listener) => {
      session.pushListener = listener;
    },
    ended: session.ending.ended,
    destroy: () => {
      finish(session, { byServer: false });
    },
  };
}

// Named generic so the request keeps the method's params and result types (ParamsOf, ResultOf).
function requestOn(session: Session): DedicatedConnection['request'] {
  return function request<M extends Method>(
    method: M,
    params: ParamsOf<M>,
    options: DedicatedRequestOptions = {},
  ): Promise<ResultOf<M>> {
    return sendRequest(session, method, params, options);
  };
}

// Reports the call to onCall once, whatever the outcome; the hook cannot change the result.
function sendRequest<M extends Method>(
  session: Session,
  method: M,
  params: ParamsOf<M>,
  options: DedicatedRequestOptions,
): Promise<ResultOf<M>> {
  const startedAt = performance.now();
  return exchange(session, method, params, options).then(
    (value) => {
      reportCall(session.onCall, { method, durationMs: performance.now() - startedAt, outcome: CallOutcome.Answered });
      return typedResult<M>(value);
    },
    (error: unknown) => {
      reportCall(session.onCall, { method, durationMs: performance.now() - startedAt, ...outcomeOf(error) });
      throw error;
    },
  );
}

// The reply is typed by the method's result; the wire layer trusts herdr's shape here, as rpc does.
function typedResult<M extends Method>(value: unknown): ResultOf<M> {
  return value as ResultOf<M>;
}

function exchange(
  session: Session,
  method: Method,
  params: unknown,
  options: DedicatedRequestOptions,
): Promise<unknown> {
  if (session.finished) {
    return Promise.reject(new HerdrTransportError(ErrorText.ClosedBeforeResponse(method)));
  }
  if (session.pending !== undefined) {
    return Promise.reject(new HerdrTransportError(DedicatedText.RequestPending(method)));
  }
  return new Promise<unknown>((resolve, reject) => {
    const pending: Pending = {
      method,
      requestId: nextId(),
      resolve,
      reject,
      timer: undefined,
      detachAbort: NO_CLEANUP,
    };
    session.pending = pending;
    pending.detachAbort = listenForAbort(options.signal, () => {
      failRequest(session, new HerdrTransportError(ErrorText.Aborted(method)));
    });
    if (session.pending !== pending) {
      // An abort that was already on the signal settled the request before it was sent.
      return;
    }
    armTimeout(session, pending, options.timeoutMs);
    if (!session.finished) {
      session.connection?.writeLine(encodeRequest(pending.requestId, method, params));
    }
  });
}

function armTimeout(session: Session, pending: Pending, timeoutMs: number | undefined): void {
  if (timeoutMs === undefined) {
    return;
  }
  pending.timer = setTimeout(() => {
    failRequest(session, new HerdrTransportError(ErrorText.NoResponse(pending.method, timeoutMs), { isTimeout: true }));
  }, timeoutMs);
}

// Reads one line: an unparseable one ends the connection; an id-less one is a push; any other is a reply to the request.
function routeLine(session: Session, text: string): void {
  if (session.finished) {
    return;
  }
  const line = parseObject(text);
  if (line === undefined) {
    finish(session, { byServer: false, cause: new HerdrTransportError(DedicatedText.Malformed) });
    return;
  }
  if (!(WireField.Id in line)) {
    session.pushListener?.(line);
    return;
  }
  routeReply(session, line);
}

function parseObject(text: string): object | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  return isObject(value) ? value : undefined;
}

// The reply carries the request id, or the empty id herdr uses for an unparseable request (W3). Any other id is a stray.
function routeReply(session: Session, reply: object): void {
  const pending = session.pending;
  if (pending === undefined || !isAnswerTo(pending, reply)) {
    return;
  }
  if (isErrorEnvelope(reply)) {
    const { error } = reply;
    settleRequest(session, (done) => {
      done.reject(HerdrError.from(done.method, error));
    });
    return;
  }
  const result = resultOf(reply);
  settleRequest(session, (done) => {
    done.resolve(result);
  });
}

function isAnswerTo(pending: Pending, reply: object): boolean {
  const id = idOf(reply);
  return id === pending.requestId || id === EMPTY_REPLY_ID;
}

function idOf(reply: object): unknown {
  return WireField.Id in reply ? reply[WireField.Id] : undefined;
}

function resultOf(reply: object): unknown {
  return WireField.Result in reply ? reply[WireField.Result] : undefined;
}

// The first exit wins: clears the timer and the abort listener, then runs the outcome once.
function settleRequest(session: Session, outcome: (pending: Pending) => void): void {
  const pending = session.pending;
  if (pending === undefined) {
    return;
  }
  session.pending = undefined;
  clearTimeout(pending.timer);
  pending.detachAbort();
  outcome(pending);
}

// A request that timed out or was aborted rejects, and the connection is destroyed: its state after that is unknown.
function failRequest(session: Session, error: HerdrTransportError): void {
  settleRequest(session, (pending) => {
    pending.reject(error);
  });
  finish(session, { byServer: false, cause: error });
}

// Ends the connection once: a request still waiting rejects with the cause (or a closed-before-response error), the socket is destroyed, `ended` resolves.
function finish(session: Session, end: DedicatedEnd): void {
  if (session.finished) {
    return;
  }
  session.finished = true;
  session.detachSignal();
  settleRequest(session, (pending) => {
    pending.reject(end.cause ?? new HerdrTransportError(ErrorText.ClosedBeforeResponse(pending.method)));
  });
  session.connection?.destroy();
  session.ending.settle(end);
}

// Runs the handler when the signal aborts (at once when it already has). Returns the function that removes the listener.
function listenForAbort(signal: AbortSignal | undefined, onAbort: () => void): () => void {
  if (signal === undefined) {
    return NO_CLEANUP;
  }
  if (signal.aborted) {
    onAbort();
    return NO_CLEANUP;
  }
  signal.addEventListener('abort', onAbort, { once: true });
  return () => {
    signal.removeEventListener('abort', onAbort);
  };
}
