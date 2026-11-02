// Role: maps a Promise-core error to its Effect tagged error (stub until lane P6a).
// Informs HERDR-ADR-0004 and plan 3.7; contract in effect/types.ts (ToTaggedError).
import { Lane } from '../constants.ts';
import { notImplemented } from '../not-implemented.ts';
import type { ToTaggedError } from './types.ts';

export const toTaggedError: ToTaggedError = () => notImplemented('toTaggedError', Lane.P6a);
