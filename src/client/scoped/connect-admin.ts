// Role: connectAdmin(): every method, for /admin (server control, destructive and spawning methods included).
// Informs HERDR-ADR-0005 (the admin subpath holds D, S and X) and plan 3.4; contract in client/types.ts (ConnectAdmin).
import { EntryKey } from '../../constants.ts';
import { connectCore } from '../connect-core.ts';
import type { AdminClient, ConnectAdmin } from '../types.ts';
import { allowedMethods } from './allowed-methods.ts';
import { composeOrClose, ENTRY_MEMBERS } from './compose.ts';

export const connectAdmin: ConnectAdmin = async function connectAdmin(options = {}) {
  const core = await connectCore(options);
  return composeOrClose<AdminClient>(core, allowedMethods(EntryKey.admin), ENTRY_MEMBERS[EntryKey.admin]);
};
