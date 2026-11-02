// Role: toolNameOf(): the MCP tool name of a read-only method (herdr_ + the method with dots as underscores). Pure.
// Informs HERDR-ADR-0010 and plan 7 (lane P6c); contract in mcp/types.ts (ToolNameOf).
import { McpToolName } from '../constants.ts';
import type { ToolNameOf } from './types.ts';

export const toolNameOf: ToolNameOf = (method) =>
  McpToolName.Prefix + method.replaceAll(McpToolName.MethodSeparator, McpToolName.ToolSeparator);
