// Role: exitCodeFor(): maps a drift outcome to the CLI exit code (stub until lane P5c).
// Informs HERDR-ADR-0009 and plan 6; contract in drift/types.ts (ExitCodeFor).
import { Lane } from '../constants.ts';
import { notImplemented } from '../not-implemented.ts';
import type { ExitCodeFor } from './types.ts';

export const exitCodeFor: ExitCodeFor = () => notImplemented('exitCodeFor', Lane.P5c);
