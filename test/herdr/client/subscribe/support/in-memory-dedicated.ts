// Role: an in-memory OpenDedicated stub: one scripted DedicatedConnection that the test drives (ack, reject the ack, push lines, close from the server, fail) and that records what the code asked of it.
// Informs HERDR-ADR-0008 (fakes only) and HERDR-ADR-0017 (unit tests run against the contract, not a socket); lane test helper for createSubscribe.
import { HerdrTransportError } from '../../../../../src/herdr/wire/errors.ts';
import type { DedicatedConnection, DedicatedEnd, DedicatedOptions, DedicatedRequestOptions, OpenDedicated } from '../../../../../src/herdr/wire/types.ts';
import type { ParamsOf, ResultOf } from '../../../../../src/herdr/wire/typed.ts';
import type { Method } from '../../../../../src/herdr/generated/index.ts';

export interface SentRequest {
  readonly method: string;
  readonly params: unknown;
  readonly options: DedicatedRequestOptions | undefined;
}

export interface InMemoryDedicated {
  readonly open: OpenDedicated;
  readonly openedWith: DedicatedOptions[];
  readonly requests: SentRequest[];
  readonly destroyed: boolean;
  // Resolves the pending request with a result (the subscription ack, by default).
  reply(result: unknown): void;
  // Rejects the pending request.
  rejectRequest(error: unknown): void;
  pushLine(line: object): void;
  // The server closes the connection cleanly.
  serverClose(): void;
  // The connection fails with a cause.
  fail(cause: unknown): void;
  // The next open rejects, as when nothing listens.
  failOpen(error: unknown): void;
}

// The stub returns what the code under test is given; the cast is the stub's one typed boundary, where a test supplies the reply.
export function createInMemoryDedicated(): InMemoryDedicated {
  const openedWith: DedicatedOptions[] = [];
  const requests: SentRequest[] = [];
  let pendingOpenError: unknown;
  let pushListener: ((line: object) => void) | undefined;
  let pendingRequest: { resolve: (value: unknown) => void; reject: (reason: unknown) => void } | undefined;
  let destroyed = false;
  let ending: ((end: DedicatedEnd) => void) | undefined;
  const ended = new Promise<DedicatedEnd>((resolve) => {
    ending = resolve;
  });

  // The first end wins: a pending request rejects with the cause, then `ended` resolves.
  const finish = (end: DedicatedEnd): void => {
    if (ending === undefined) {
      return;
    }
    const settle = ending;
    ending = undefined;
    const request = pendingRequest;
    pendingRequest = undefined;
    request?.reject(end.cause ?? new HerdrTransportError('stub: connection closed before a response'));
    settle(end);
  };

  const connection: DedicatedConnection = {
    request<M extends Method>(method: M, params: ParamsOf<M>, options?: DedicatedRequestOptions): Promise<ResultOf<M>> {
      requests.push({ method, params, options });
      if (pendingRequest !== undefined) {
        return Promise.reject(new HerdrTransportError('stub: a request is already pending'));
      }
      return new Promise<unknown>((resolve, reject) => {
        pendingRequest = { resolve, reject };
      }) as Promise<ResultOf<M>>;
    },
    onPush(listener) {
      pushListener = listener;
    },
    ended,
    destroy() {
      destroyed = true;
      finish({ byServer: false });
    },
  };

  const open: OpenDedicated = (options) => {
    openedWith.push(options);
    if (pendingOpenError !== undefined) {
      const error = pendingOpenError;
      pendingOpenError = undefined;
      return Promise.reject(error);
    }
    // The contract: an abort of the open signal destroys the connection and ends it by the caller (byServer false).
    options.signal?.addEventListener('abort', () => {
      destroyed = true;
      finish({ byServer: false });
    });
    return Promise.resolve(connection);
  };

  return {
    open,
    openedWith,
    requests,
    get destroyed() {
      return destroyed;
    },
    reply(result) {
      const request = pendingRequest;
      pendingRequest = undefined;
      request?.resolve(result);
    },
    rejectRequest(error) {
      const request = pendingRequest;
      pendingRequest = undefined;
      request?.reject(error);
    },
    pushLine(line) {
      pushListener?.(line);
    },
    serverClose() {
      finish({ byServer: true });
    },
    fail(cause) {
      finish({ byServer: false, cause });
    },
    failOpen(error) {
      pendingOpenError = error;
    },
  };
}
