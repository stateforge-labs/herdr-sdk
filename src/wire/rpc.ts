// Role: one request, one answer: opens a fresh connection per call, writes the request line, takes the first matching reply and destroys the socket on every exit.
// Informs HERDR-ADR-0016 (W1 close after every response, W3 id "" accepted, W2 events carry no id), HERDR-ADR-0004 (Promise core), plan 3.1 and 3.3;
// ported from the hub vendor client/rpc.ts (settle-once, destroy on every exit, late-open destroyed, AbortSignal) with atalaya's timing hook.
import { CallOutcome, EMPTY_REPLY_ID, ErrorText } from '../constants.ts';
import type { Method } from '../generated/index.ts';
import { outcomeOf, reportCall } from './call-hook.ts';
import { Connection } from './connection.ts';
import { HerdrError, HerdrTransportError } from './errors.ts';
import { encodeRequest, isErrorEnvelope, isObject, type ResponseEnvelope } from './envelope.ts';
import { nextId } from './id.ts';
import type { ParamsOf, ResultOf, Rpc, RpcOptions } from './types.ts';

export type { RpcOptions } from './types.ts';

// State of one call. `done` is set by the first exit; every later exit is ignored.
interface Call<R> {
  readonly method: Method;
  readonly requestId: string;
  readonly requestLine: string;
  readonly socketPath: string;
  readonly resolve: (value: R) => void;
  readonly reject: (reason: unknown) => void;
  done: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
  detachAbort: () => void;
  connection: Connection | undefined;
}

const NO_CLEANUP = (): void => undefined;

export const rpc: Rpc = async function rpc<M extends Method>(opts: RpcOptions, method: M, params: ParamsOf<M>): Promise<ResultOf<M>> {
  const startedAt = performance.now();
  try {
    const result = await exchange(opts, method, params);
    reportCall(opts.onCall, { method, durationMs: performance.now() - startedAt, outcome: CallOutcome.Answered });
    return result;
  } catch (error) {
    reportCall(opts.onCall, { method, durationMs: performance.now() - startedAt, ...outcomeOf(error) });
    throw error;
  }
};

function exchange<M extends Method>(opts: RpcOptions, method: M, params: ParamsOf<M>): Promise<ResultOf<M>> {
  const requestId = nextId();
  return new Promise<ResultOf<M>>((resolve, reject) => {
    const call: Call<ResultOf<M>> = {
      method,
      requestId,
      requestLine: encodeRequest(requestId, method, params),
      socketPath: opts.socketPath,
      resolve,
      reject,
      done: false,
      timer: undefined,
      detachAbort: NO_CLEANUP,
      connection: undefined,
    };
    armAbort(call, opts.signal);
    if (call.done) {
      return;
    }
    armTimeout(call, opts.timeoutMs);
    openAndWrite(call).catch((error: unknown) => {
      failWith(call, error);
    });
  });
}

// An already-aborted signal settles the call before any connection is opened.
function armAbort<R>(call: Call<R>, signal: AbortSignal | undefined): void {
  if (signal === undefined) {
    return;
  }
  const onAbort = (): void => {
    failWith(call, new HerdrTransportError(ErrorText.Aborted(call.method)));
  };
  if (signal.aborted) {
    onAbort();
    return;
  }
  signal.addEventListener('abort', onAbort, { once: true });
  call.detachAbort = () => {
    signal.removeEventListener('abort', onAbort);
  };
}

function armTimeout<R>(call: Call<R>, timeoutMs: number | undefined): void {
  if (timeoutMs === undefined) {
    return;
  }
  call.timer = setTimeout(() => {
    failWith(call, new HerdrTransportError(ErrorText.NoResponse(call.method, timeoutMs), { isTimeout: true }));
  }, timeoutMs);
}

async function openAndWrite<R>(call: Call<R>): Promise<void> {
  const opened = await Connection.open(call.socketPath, {
    onLine: (line) => {
      handleLine(call, line);
    },
    onClose: () => {
      failWith(call, new HerdrTransportError(ErrorText.ClosedBeforeResponse(call.method)));
    },
    onError: (error) => {
      failWith(call, new HerdrTransportError(ErrorText.SocketError(call.method), { cause: error }));
    },
  });
  if (call.done) {
    // The call settled while the socket was connecting (timeout, abort): nothing is written, the socket is closed.
    opened.destroy();
    return;
  }
  call.connection = opened;
  opened.writeLine(call.requestLine);
}

// Reads one line: a malformed line fails the call, a line for another id is a stray and is ignored.
function handleLine<R>(call: Call<R>, line: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (error) {
    failWith(call, new HerdrTransportError(ErrorText.Unparseable(call.method), { cause: error }));
    return;
  }
  if (!isObject(parsed)) {
    failWith(call, new HerdrTransportError(ErrorText.Unparseable(call.method)));
    return;
  }
  const envelope = parsed as ResponseEnvelope<R>;
  if (!isAnswerTo(call, envelope)) {
    return;
  }
  if (isErrorEnvelope(envelope)) {
    failWith(call, HerdrError.from(call.method, envelope.error));
    return;
  }
  answerWith(call, envelope.result);
}

// The reply carries the request id, or the empty id herdr uses for an unparseable request (W3).
function isAnswerTo<R>(call: Call<R>, envelope: ResponseEnvelope<R>): boolean {
  return envelope.id === call.requestId || envelope.id === EMPTY_REPLY_ID;
}

// The first exit wins: clears the timer and the abort listener, runs the outcome, then destroys the socket.
function settle<R>(call: Call<R>, outcome: () => void): void {
  if (call.done) {
    return;
  }
  call.done = true;
  clearTimeout(call.timer);
  call.detachAbort();
  outcome();
  call.connection?.destroy();
}

function failWith<R>(call: Call<R>, error: unknown): void {
  settle(call, () => {
    call.reject(error);
  });
}

function answerWith<R>(call: Call<R>, result: R): void {
  settle(call, () => {
    call.resolve(result);
  });
}
