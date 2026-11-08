// Role: builds the stream members of one client from its transport: events.subscribe, the watch factory and hold, each with the client's resolved settings.
// This module is the heavy half: it is loaded through a dynamic import by lazy-streams.ts, so it stays out of a client that never streams (plan 10.1 step 3).
// Informs plan 3.3 (the transport is resolved once), plan 3.6 and HERDR-ADR-0015; contracts in subscribe, watch and held types.
import { openDedicated } from '../../wire/dedicated.ts';
import type { CreateHold, Hold } from '../held/types.ts';
import { createHold as defaultCreateHold } from '../held/hold.ts';
import { createSubscribe as defaultCreateSubscribe } from '../subscribe/subscribe.ts';
import type { CreateSubscribe, Subscribe } from '../subscribe/types.ts';
import { createWatch as defaultCreateWatch } from '../watch/watch.ts';
import type { CreateWatch, WatchFn } from '../watch/types.ts';
import type { ClientTransport, CoreClient, StreamMembers } from '../types.ts';
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

// watch() is built on events.subscribe and session.snapshot. Whether the client may use both is checked by compose.ts before this runs (synchronously, plan 3.4).
export function watchFor(subscribe: Subscribe, create: CreateWatch = defaultCreateWatch): WatchFn {
  return create(subscribe);
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

/** The three stream members of one client, built from its core. Called once, by the lazy loader, on first use. */
export function createStreamMembers(core: CoreClient): StreamMembers {
  const subscribe = subscribeFor(core.transport);
  return { subscribe, watch: watchFor(subscribe), hold: holdFor(core) };
}
