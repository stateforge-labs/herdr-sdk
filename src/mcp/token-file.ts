// Role: tokenFile() for the read-only MCP add-on (stub until lane P6c).
// Informs HERDR-ADR-0010 and plan 7; contract in mcp/types.ts (TokenFile).
import { Lane } from '../constants.ts';
import { notImplemented } from '../not-implemented.ts';
import type { TokenFile } from './types.ts';

export const tokenFile: TokenFile = () => notImplemented('tokenFile', Lane.P6c);
