// Role: tokenFile(): the MCP bearer token kept in a 0600 file. Read-or-create: a well-formed token is kept, anything else is replaced.
// Informs HERDR-ADR-0010 and plan 7 (lane P6c); contract in mcp/types.ts (TokenFile). Port of the hub's mcp-token-file.ts.
// The token is never in an error message.
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ErrnoCode, McpToken, McpTokenMessage, TEXT_ENCODING } from '../constants.ts';
import { ensureOwnerDir } from './private-dir.ts';
import type { TokenFile } from './types.ts';

// The token on disk, trimmed. Undefined when there is no file yet; any other read failure is an error.
const readExistingToken = (path: string): string | undefined => {
  try {
    return readFileSync(path, TEXT_ENCODING).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === ErrnoCode.NoEntry) return undefined;
    throw new Error(McpTokenMessage.ReadFailed);
  }
};

// A missing, empty or truncated token is replaced; a token of the right length is kept.
const isWellFormed = (token: string | undefined): token is string =>
  token !== undefined && token.length === McpToken.HexLength;

const newToken = (): string => randomBytes(McpToken.Bytes).toString(McpToken.Encoding);

// writeFileSync keeps the mode of a file that already exists, so the mode is tightened before the token goes in:
// no token is ever written under an older, looser mode.
const writeToken = (path: string, token: string): void => {
  try {
    ensureOwnerDir(dirname(path));
    if (existsSync(path)) chmodSync(path, McpToken.FileMode);
    writeFileSync(path, token, { mode: McpToken.FileMode });
  } catch {
    throw new Error(McpTokenMessage.WriteFailed);
  }
};

const readOrCreateToken = async (path: string): Promise<string> => {
  const existing = readExistingToken(path);
  const token = isWellFormed(existing) ? existing : newToken();
  writeToken(path, token);
  return token;
};

export const tokenFile: TokenFile = (options) => ({
  path: options.path,
  readOrCreate: () => readOrCreateToken(options.path),
});
