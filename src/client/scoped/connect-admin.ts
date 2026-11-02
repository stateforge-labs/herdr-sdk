// Role: connectAdmin(): every method, for /admin (stub until lane P2b).
// Informs HERDR-ADR-0005 (capability-scoped clients) and plan 3.3-3.4; contract in client/types.ts (ConnectAdmin).
import { Lane } from '../../constants.ts';
import { notImplemented } from '../../not-implemented.ts';
import type { ConnectAdmin } from '../types.ts';

export const connectAdmin: ConnectAdmin = () => notImplemented('connectAdmin', Lane.P2b);
