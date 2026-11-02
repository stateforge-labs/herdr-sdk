// Role: driftBetween(): compares the committed and the installed schema (stub until lane P5c).
// Informs HERDR-ADR-0009 and plan 6; contract in drift/types.ts (DriftBetween).
import { Lane } from '../constants.ts';
import { notImplemented } from '../not-implemented.ts';
import type { DriftBetween } from './types.ts';

export const driftBetween: DriftBetween = () => notImplemented('driftBetween', Lane.P5c);
