// Role: events.subscribe over a dedicated connection (stub until lane P4a; building it is safe, calling it throws).
// Informs HERDR-ADR-0007, HERDR-ADR-0016 (W2, P3) and plan 3.6; contract in client/subscribe/types.ts.
import { Lane } from '../../constants.ts';
import { notImplemented } from '../../not-implemented.ts';
import type { CreateSubscribe } from './types.ts';

export const createSubscribe: CreateSubscribe = () => () => notImplemented('events.subscribe', Lane.P4a);
