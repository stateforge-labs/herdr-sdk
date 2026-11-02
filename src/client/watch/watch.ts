// Role: watch(): snapshot, replay and resubscribe with backoff (stub until lane P4b; building it is safe, calling it throws).
// Informs HERDR-ADR-0007, HERDR-ADR-0016 (W5) and plan 3.6; contract in client/watch/types.ts.
import { Lane } from '../../constants.ts';
import { notImplemented } from '../../not-implemented.ts';
import type { CreateWatch } from './types.ts';

export const createWatch: CreateWatch = () => () => notImplemented('watch', Lane.P4b);
