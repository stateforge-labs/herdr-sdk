// Role: held connections: one socket kept open for a run of calls, its end state and its abort handling.
// Informs HERDR-ADR-0017, HERDR-ADR-0007, plan 3.6, HERDR-ADR-0016; merged by HERDR-ADR-0021 from types.ts, until-aborted.ts, held-connection.ts, held-invoke.ts, hold.ts.
import type { HeldNamespaces, Method } from '../generated/index.ts';
import type { AllowedMethods, BuildNamespaceTree, ClientCapabilities, NamespaceTree, CallOptions, Invoke } from './types.ts';
import type { OnCall, OpenDedicated, DedicatedConnection, ParamsOf } from '../wire/types.ts';
import { HeldText } from '../../constants.ts';
import { HerdrTransportError } from '../errors.ts';
import { assertCapability } from './connect.ts';
import { HELD_METHODS } from '../generated/entries/held.ts';

/**
 * One dedicated connection carrying the class C methods as namespaces (`held.client.window_title.set`,
 * `held.client_shell.surface.set`, `held.server.ssh_agent.register`); capability gates apply (UnsupportedByServerError
 * before sending). Closing it ends the registration, lease or title. If the server closes it, `ended` resolves and
 * every later call rejects with HerdrTransportError.
 */
export interface HeldConnection extends HeldNamespaces, AsyncDisposable {
  readonly ended: Promise<void>;
  /** Destroys the connection. Idempotent. */
  close(): Promise<void>;
}

export interface HoldOptions {
  readonly signal?: AbortSignal | undefined;
}

/** `herdr.hold(options)`. */
export type Hold = (options?: HoldOptions) => Promise<HeldConnection>;

/**
 * What the client hands the hold factory. The held tree is built with the same builder and allow-list as every
 * client (P2b's buildNamespaceTree and allowedMethods over HELD_METHODS); they are injected so P4b's unit tests can pass a tiny
 * builder, and P2b passes the real ones. Each leaf is an Invoke that applies the capability gate, then sends on the
 * dedicated connection.
 */
export interface HoldDeps {
  readonly socketPath: string;
  /** The client's resolved timeout (ClientTransport.timeoutMs). */
  readonly timeoutMs: number;
  readonly capabilities: ClientCapabilities;
  readonly onCall?: OnCall | undefined;
  readonly open: OpenDedicated;
  readonly buildTree: BuildNamespaceTree;
  readonly allowedMethods: AllowedMethods;
  /** The client close signal (ClientTransport.closed): when it aborts, every held connection of this client closes. */
  readonly signal: AbortSignal;
}

/** Builds hold() of one client. Implemented by client/held/hold.ts (P4b). */
export type CreateHold = (deps: HoldDeps) => Hold;

// Resolves or rejects with the work, unless the signal aborts first: then it rejects with the signal's reason at once.
export function untilAborted<T>(work: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (signal === undefined) {
    return work;
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
    }
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

export interface EndState {
  /** Resolves when the dedicated connection closed for any reason (server, destroy or abort). */
  readonly ended: Promise<void>;
  /** True once the connection closed; read synchronously before each call. */
  isEnded(): boolean;
}

// Records the end in a flag as well as in the promise, so a call made after the end can be refused without waiting.
export function trackEnd(conn: DedicatedConnection): EndState {
  let closed = false;
  const ended = conn.ended.then(() => {
    closed = true;
  });
  return {
    ended,
    isEnded: (): boolean => closed,
  };
}

// The single NamespaceTree -> HeldNamespaces assertion. The tree is built by the same builder and allow-list as every client
// (buildNamespaceTree with the held list, HELD_METHODS), so its leaves have exactly the shape HeldNamespaces declares.
export function toHeldConnection(
  tree: NamespaceTree,
  conn: DedicatedConnection,
  end: EndState,
  signal: AbortSignal,
): HeldConnection {
  // Closing detaches the abort listener, so a long-lived client does not keep one per hold.
  const close = closeOnce(conn, end.ended, () => signal.removeEventListener('abort', onAbort));
  const onAbort = (): void => {
    void close();
  };
  if (signal.aborted) {
    void close();
  } else {
    signal.addEventListener('abort', onAbort, { once: true });
  }
  const namespaces = tree as unknown as HeldNamespaces;
  return {
    ...namespaces,
    ended: end.ended,
    close,
    [Symbol.asyncDispose]: close,
  };
}

// The first call destroys the connection and waits for it to end; later calls return the same promise.
function closeOnce(conn: DedicatedConnection, ended: Promise<void>, detach: () => void): () => Promise<void> {
  let closing: Promise<void> | undefined;
  return () => {
    closing ??= destroyAndWait(conn, ended, detach);
    return closing;
  };
}

async function destroyAndWait(conn: DedicatedConnection, ended: Promise<void>, detach: () => void): Promise<void> {
  detach();
  conn.destroy();
  await ended;
}

export interface HeldInvokeDeps {
  readonly capabilities: ClientCapabilities;
  readonly timeoutMs: number;
}

export function createHeldInvoke(conn: DedicatedConnection, deps: HeldInvokeDeps, isEnded: () => boolean): Invoke {
  // Every call waits for the previous one, so a second request never reaches the connection while one is pending.
  let previous: Promise<unknown> = Promise.resolve();
  return async function invokeHeld(method: Method, params: unknown, options?: CallOptions): Promise<unknown> {
    assertCapability(method, deps.capabilities);
    const signal = options?.signal;
    const send = async (): Promise<unknown> => {
      // A call aborted while it was queued is never sent.
      if (signal?.aborted === true) {
        throw signal.reason;
      }
      if (isEnded()) {
        throw new HerdrTransportError(HeldText.Ended(method));
      }
      // Invoke erases the params type (client/types.ts); the generated namespaces type them at the leaf that calls this.
      return conn.request(method, params as ParamsOf<Method>, {
        timeoutMs: options?.timeoutMs ?? deps.timeoutMs,
        signal,
      });
    };
    const run = previous.then(send);
    previous = run.catch(() => undefined);
    // The caller hears its own abort at once, even while the call waits for an earlier one.
    return untilAborted(run, signal);
  };
}

// One connection per hold(), open until close(), the client's close, the caller's signal, or the server's close. Every held call goes over it.
export const createHold: CreateHold = (deps) => async function hold(options: HoldOptions = {}): Promise<HeldConnection> {
  // The held connection closes when either the client closes or the caller's signal aborts.
  const signal = options.signal === undefined ? deps.signal : AbortSignal.any([deps.signal, options.signal]);
  const conn = await deps.open({ socketPath: deps.socketPath, signal, onCall: deps.onCall });
  const end = trackEnd(conn);
  const invoke = createHeldInvoke(conn, deps, end.isEnded);
  const tree = deps.buildTree(deps.allowedMethods(HELD_METHODS), invoke);
  return toHeldConnection(tree, conn, end, signal);
};
