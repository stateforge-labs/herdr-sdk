// Role: finds the herdr socket: an explicit option, then HERDR_SOCKET, then ~/.config/herdr/herdr.sock; checks that the path is a socket.
// Informs HERDR-ADR-0003 (layers) and plan 3.3 (socketPath option); ported from atalaya src/transport/socket-path.ts and hub infra/herdr/socket-path.ts (explicit option and existence check added).
import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ErrorText, HerdrEnv, SocketPathPart } from '../../constants.ts';
import { HerdrTransportError } from './errors.ts';

export type EnvMap = Readonly<Record<string, string | undefined>>;

export interface SocketPathOptions {
  socketPath?: string | undefined;
  env?: EnvMap | undefined;
}

// The socket path when no explicit option is given. The env is passed in, so tests never read process.env.
export function defaultSocketPath(env: EnvMap = process.env): string {
  return (
    env[HerdrEnv.Socket] ??
    join(env[HerdrEnv.Home] ?? homedir(), SocketPathPart.ConfigDir, SocketPathPart.HerdrDir, SocketPathPart.SocketFile)
  );
}

// An explicit socketPath option wins over the environment and the default.
export function resolveSocketPath(options: SocketPathOptions): string {
  return options.socketPath ?? defaultSocketPath(options.env);
}

// Throws a transport error when nothing is a socket at the path (missing path, regular file, directory).
export function assertSocketExists(path: string): void {
  const stats = statSync(path, { throwIfNoEntry: false });
  if (stats?.isSocket() !== true) {
    throw new HerdrTransportError(ErrorText.NoSocket(path));
  }
}
