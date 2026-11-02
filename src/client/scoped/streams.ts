// Role: builds the stream members of one client from its transport: events.subscribe, watch() and hold(), each with the client's resolved settings.
// Informs plan 3.3 (the transport is resolved once), plan 3.4 (watch fails at construction without session.keep snapshot) and plan 3.6; contracts in subscribe/watch/held types.
import { ErrorText } from '../../constants.ts';
import { Method } from '../../generated/index.ts';
import { HerdrTransportError } from '../../wire/errors.ts';
import { openDedicated } from '../../wire/dedicated.ts';
import type { CreateHold, Hold } from '../held/types.ts';
import { createHold as defaultCreateHold } from '../held/hold.ts';
import { createSubscribe as defaultCreateSubscribe } from '../subscribe/subscribe.ts';
import type { CreateSubscribe, Subscribe } from '../subscribe/types.ts';
import { createWatch as defaultCreateWatch } from '../watch/watch.ts';
import type { CreateWatch, WatchFn } from '../watch/types.ts';
import type { ClientTransport, CoreClient } from '../types.ts';
import { buildNamespaceTree } from './namespace-tree.ts';
import { allowedMethods } from './allowed-methods.ts';

// The factories are parameters so a test can spy on what they receive; the defaults are the real ones.
export function subscribeFor(transport: ClientTransport, create: CreateSubscribe = defaultCreateSubscribe): Subscribe {
  return create({
    socketPath: transport.socketPath,
    timeoutMs: transport.timeoutMs,
    onCall: transport.onCall,
    onUnknown: transport.onUnknown,
    signal: transport.closed,
    open: openDedicated,
  });
}

// watch() is built on events.subscribe and reads the present with session.snapshot; without either, the watch cannot
// run, so construction fails here (plan 3.4). Both checks run before anything is sent.
export function watchFor(
  subscribe: Subscribe,
  allowed: ReadonlySet<Method>,
  create: CreateWatch = defaultCreateWatch,
): WatchFn {
  requireAllowed(Method.EventsSubscribe, allowed);
  requireAllowed(Method.SessionSnapshot, allowed);
  return create(subscribe);
}

function requireAllowed(method: Method, allowed: ReadonlySet<Method>): void {
  if (!allowed.has(method)) {
    throw new HerdrTransportError(ErrorText.NotAllowed(method));
  }
}

export function holdFor(core: CoreClient, create: CreateHold = defaultCreateHold): Hold {
  return create({
    socketPath: core.transport.socketPath,
    timeoutMs: core.transport.timeoutMs,
    capabilities: core.capabilities,
    onCall: core.transport.onCall,
    open: openDedicated,
    signal: core.transport.closed,
    buildTree: buildNamespaceTree,
    allowedMethods,
  });
}
