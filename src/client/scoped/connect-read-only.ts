// Role: connectReadOnly(): structure reads and long-poll; content and presets on opt-in (stub until lane P2b).
// Informs HERDR-ADR-0005 (capability-scoped clients) and plan 3.3-3.4; contract in client/types.ts (ConnectReadOnly).
import { Lane } from '../../constants.ts';
import { notImplemented } from '../../not-implemented.ts';
import type { ConnectReadOnly } from '../types.ts';

export const connectReadOnly: ConnectReadOnly = () => notImplemented('connectReadOnly', Lane.P2b);
