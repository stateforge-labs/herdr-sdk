// Role: refuses a gated method before anything is sent when the server did not advertise the capability it needs.
// Informs plan 3.1 (a method gated by a capability throws UnsupportedByServerError before sending) and HERDR-ADR-0005 (capability-scoped clients); the gate table is generated (CAPABILITY_GATE, gen/overrides.ts).
import { CAPABILITY_GATE, type Method, type ServerCapability } from '../generated/index.ts';
import { UnsupportedByServerError } from '../wire/errors.ts';
import type { ClientCapabilities } from './types.ts';

const GATES: Partial<Record<Method, ServerCapability>> = CAPABILITY_GATE;

export function assertCapability(method: Method, capabilities: ClientCapabilities): void {
  const capability = GATES[method];
  if (capability !== undefined && capabilities[capability] !== true) {
    throw new UnsupportedByServerError(method, capability);
  }
}
