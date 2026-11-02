// Role: connect(): the core client composed with the full entry (every method but admin-only ones, plus call, events.subscribe, watch and hold).
// Informs HERDR-ADR-0005 (connect() excludes D, S and X), plan 3.3 and 3.4; contract in client/types.ts (Connect).
import { EntryKey } from '../constants.ts';
import { connectCore } from './connect-core.ts';
import type { Client, Connect } from './types.ts';
import { allowedMethods } from './scoped/allowed-methods.ts';
import { composeOrClose, ENTRY_MEMBERS } from './scoped/compose.ts';

export const connect: Connect = async function connect(options = {}) {
  const core = await connectCore(options);
  return composeOrClose<Client>(core, allowedMethods(EntryKey.client), ENTRY_MEMBERS[EntryKey.client]);
};
