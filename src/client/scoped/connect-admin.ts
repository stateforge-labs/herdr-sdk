// Role: connectAdmin(): every method, for /admin (server control, destructive and spawning methods included).
// Informs HERDR-ADR-0005 (the admin subpath holds D, S and X), plan 3.4 and 10.1 steps 2 and 3; contract in client/types.ts (ConnectAdmin).
import { EntryKey } from '../../constants.ts';
import { ADMIN_METHODS } from '../../generated/entries/admin.ts';
import { connectCore } from '../connect-core.ts';
import type { AdminClient, ConnectAdmin } from '../types.ts';
import { allowedMethods } from './allowed-methods.ts';
import { composeOrClose, ENTRY_MEMBERS } from './compose.ts';
import { lazyStreams } from './lazy-streams.ts';

export const connectAdmin: ConnectAdmin = async function connectAdmin(options = {}) {
  const core = await connectCore(options);
  return composeOrClose<AdminClient>(
    core,
    allowedMethods(ADMIN_METHODS),
    ENTRY_MEMBERS[EntryKey.admin],
    lazyStreams(core),
  );
};
