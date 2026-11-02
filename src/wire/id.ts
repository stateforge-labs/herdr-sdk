// Role: makes a request id, an echo the server returns on its reply; it is not a correlation key (HERDR-ADR-0016 W1).
// Informs HERDR-ADR-0016 (W1) and plan 3.1; ported from atalaya src/protocol/id.ts (file name mirrors plan 3 `id`).
import { REQUEST_ID_PREFIX } from '../constants.ts';

const FIRST_COUNT = 1;

let counter = 0;

export function nextId(prefix: string = REQUEST_ID_PREFIX): string {
  counter += FIRST_COUNT;
  return `${prefix}-${counter}-${Date.now().toString(36)}`;
}
