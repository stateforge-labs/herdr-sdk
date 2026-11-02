// Role: decodes one push line into a known frame or an UnknownFrame (stub until lane P4a).
// Informs HERDR-ADR-0016 (P3, P4), HERDR-ADR-0007 and plan 3.6; contract in wire/types.ts (DecodePush).
import { Lane } from '../constants.ts';
import { notImplemented } from '../not-implemented.ts';
import type { DecodePush } from './types.ts';

export const decodePush: DecodePush = () => notImplemented('decodePush', Lane.P4a);
