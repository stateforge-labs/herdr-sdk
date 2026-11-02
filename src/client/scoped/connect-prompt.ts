// Role: connectPrompt(): R-meta plus agent.prompt (stub until lane P2b).
// Informs HERDR-ADR-0005 (capability-scoped clients) and plan 3.3-3.4; contract in client/types.ts (ConnectPrompt).
import { Lane } from '../../constants.ts';
import { notImplemented } from '../../not-implemented.ts';
import type { ConnectPrompt } from '../types.ts';

export const connectPrompt: ConnectPrompt = () => notImplemented('connectPrompt', Lane.P2b);
