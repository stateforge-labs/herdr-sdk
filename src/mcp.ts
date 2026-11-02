// Role: the /mcp entry. Until amendment A1 it exposes only the effect-free contract: tool naming, bearerGuard, tokenFile.
// Informs HERDR-ADR-0003, HERDR-ADR-0010 and HERDR-ADR-0017; edited only by the integration step.
export { bearerGuard } from './mcp/bearer-guard.ts';
export { tokenFile } from './mcp/token-file.ts';
export { toolNameOf } from './mcp/tool-name.ts';
export type * from './mcp/types.ts';
