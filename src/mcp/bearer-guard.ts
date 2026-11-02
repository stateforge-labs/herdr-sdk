// Role: bearerGuard() for the read-only MCP add-on (stub until lane P6c).
// Informs HERDR-ADR-0010 and plan 7; contract in mcp/types.ts (BearerGuard).
import { Lane } from '../constants.ts';
import { notImplemented } from '../not-implemented.ts';
import type { BearerGuard } from './types.ts';

export const bearerGuard: BearerGuard = () => notImplemented('bearerGuard', Lane.P6c);
