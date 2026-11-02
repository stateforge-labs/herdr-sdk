// Role: ensureOwnerDir(): makes a directory private (mode 0700); the one helper of the token file.
// Informs HERDR-ADR-0010 and plan 9 (lane P6c). Documented duplicate of the hub's shared/infra/private-dir.ts.
import { chmodSync, mkdirSync } from 'node:fs';
import { McpToken } from '../constants.ts';

// mkdir keeps the mode of a directory that already exists, so the mode is set explicitly afterwards.
export const ensureOwnerDir = (dir: string): void => {
  mkdirSync(dir, { recursive: true, mode: McpToken.DirMode });
  chmodSync(dir, McpToken.DirMode);
};
