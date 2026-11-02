// Role: the allow-list of one entry, preset or method list (stub until lane P2b).
// Informs HERDR-ADR-0005 (capability-scoped clients) and plan 3.3-3.4; contract in client/types.ts (AllowedMethods).
import { Lane } from '../../constants.ts';
import { notImplemented } from '../../not-implemented.ts';
import type { AllowedMethods } from '../types.ts';

export const allowedMethods: AllowedMethods = () => notImplemented('allowedMethods', Lane.P2b);
