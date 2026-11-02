// Role: opens a dedicated connection for subscriptions and held connections (stub until lane P4a).
// Informs HERDR-ADR-0016 (W1, W2), HERDR-ADR-0007 and plan 3.6; contract in wire/types.ts (OpenDedicated).
import { Lane } from '../constants.ts';
import { notImplemented } from '../not-implemented.ts';
import type { OpenDedicated } from './types.ts';

export const openDedicated: OpenDedicated = () => notImplemented('openDedicated', Lane.P4a);
