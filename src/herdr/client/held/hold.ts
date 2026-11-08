// Role: hold(): opens one dedicated connection for the class C methods, builds the held tree on it, and returns the HeldConnection (stub replaced by lane P4b).
// Informs HERDR-ADR-0007 (held connections), HERDR-ADR-0016 (W1 one request per connection; W2 the held stream) and plan 3.6; contract in client/held/types.ts.
import { HELD_METHODS } from '../../generated/entries/held.ts';
import { createHeldInvoke } from './held-invoke.ts';
import { toHeldConnection, trackEnd } from './held-connection.ts';
import type { CreateHold, HeldConnection, HoldOptions } from './types.ts';

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
