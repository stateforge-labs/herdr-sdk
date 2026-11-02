// Role: rpc timeout of a long-poll call (stub until lane P4a).
// Informs HERDR-ADR-0007 and plan 3.6; contract in client/long-poll/types.ts.
import { Lane } from '../../constants.ts';
import { notImplemented } from '../../not-implemented.ts';
import type { RequestTimeoutMs } from './types.ts';

export const requestTimeoutMs: RequestTimeoutMs = () => notImplemented('requestTimeoutMs', Lane.P4a);
