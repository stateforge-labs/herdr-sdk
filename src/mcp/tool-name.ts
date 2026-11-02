// Role: toolNameOf() for the read-only MCP add-on (stub until lane P6c).
// Informs HERDR-ADR-0010 and plan 7; contract in mcp/types.ts (ToolNameOf).
import { Lane } from '../constants.ts';
import { notImplemented } from '../not-implemented.ts';
import type { ToolNameOf } from './types.ts';

export const toolNameOf: ToolNameOf = () => notImplemented('toolNameOf', Lane.P6c);
