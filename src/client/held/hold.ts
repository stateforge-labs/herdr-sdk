// Role: hold(): a dedicated connection for class C methods (stub until lane P4b; building it is safe, calling it throws).
// Informs HERDR-ADR-0007 and plan 3.6; contract in client/held/types.ts.
import { Lane } from '../../constants.ts';
import { notImplemented } from '../../not-implemented.ts';
import type { CreateHold } from './types.ts';

export const createHold: CreateHold = () => () => notImplemented('hold', Lane.P4b);
