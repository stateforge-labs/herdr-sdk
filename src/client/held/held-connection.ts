// Role: the HeldConnection value: the tree of class C methods plus `ended`, an idempotent close(), and the disposal that `await using` calls.
// Informs plan 3.6 (held connections close on close(), on the client close and on the caller's signal) and HERDR-ADR-0016 (W1 one request per connection); contract in client/held/types.ts.
import type { HeldNamespaces } from '../../generated/index.ts';
import type { DedicatedConnection } from '../../wire/types.ts';
import type { NamespaceTree } from '../types.ts';
import type { HeldConnection } from './types.ts';

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
// (buildNamespaceTree with allowedMethods('held')), so its leaves have exactly the shape HeldNamespaces declares.
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
