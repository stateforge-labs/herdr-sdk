// Role: bounds check of a long-poll timeout before sending (stub until lane P4a).
// Informs HERDR-ADR-0007 and plan 3.6 (agent.start bounds); contract in client/long-poll/types.ts.
import { Lane } from '../../constants.ts';
import { notImplemented } from '../../not-implemented.ts';
import type { AssertLongPollBounds } from './types.ts';

export const assertLongPollBounds: AssertLongPollBounds = () => notImplemented('assertLongPollBounds', Lane.P4a);
