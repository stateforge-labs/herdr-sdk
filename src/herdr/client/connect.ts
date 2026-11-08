// Role: connect(): the core client composed with the client entry (every method but admin-only ones, plus call, events.subscribe, watch and hold).
// Informs HERDR-ADR-0005 (connect() excludes D, S and X), plan 3.3, 3.4 and 10.1 steps 2 and 3 (imports only the client list; streams load lazily); contract in client/types.ts (Connect).
import { EntryKey } from '../../constants.ts';
import { CLIENT_METHODS } from '../generated/entries/client.ts';
import { connectCore } from './connect-core.ts';
import type { Client, Connect } from './types.ts';
import { allowedMethods } from './scoped/allowed-methods.ts';
import { composeOrClose, ENTRY_MEMBERS } from './scoped/compose.ts';
import { lazyStreams } from './scoped/lazy-streams.ts';

export const connect: Connect = async function connect(options = {}) {
  const core = await connectCore(options);
  return composeOrClose<Client>(
    core,
    allowedMethods(CLIENT_METHODS),
    ENTRY_MEMBERS[EntryKey.client],
    lazyStreams(core),
  );
};
