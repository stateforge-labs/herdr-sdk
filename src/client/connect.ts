// Role: connect(): the core client plus the namespace tree, subscribe, watch and hold (stub until lane P2b).
// Informs HERDR-ADR-0005 (capability-scoped clients) and plan 3.3-3.4; contract in client/types.ts (Connect).
import { Lane } from '../constants.ts';
import { notImplemented } from '../not-implemented.ts';
import type { Connect } from './types.ts';

export const connect: Connect = () => notImplemented('connect', Lane.P2b);
