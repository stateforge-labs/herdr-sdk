// Role: finds the herdr socket: an explicit option, then HERDR_SOCKET_PATH (set by herdr for plugins), then HERDR_SOCKET (older name, kept), then ~/.config/herdr/herdr.sock; checks that the path is a socket.
// Informs HERDR-ADR-0003 (layers), plan 3.3 (socketPath option) and plan G9 (HERDR_SOCKET_PATH); an empty variable counts as unset.
import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ErrorText, HerdrEnv, SocketPathPart } from '../../constants.ts';
import { HerdrTransportError } from '../errors.ts';

export type EnvMap = Readonly<Record<string, string | undefined>>;

export interface SocketPathOptions {
  socketPath?: string | undefined;
  env?: EnvMap | undefined;
}

// The socket path when no explicit option is given. The env is passed in, so tests never read process.env.
// An empty variable is unset (||, not ??), so HERDR_SOCKET_PATH='' falls through to HERDR_SOCKET.
export function defaultSocketPath(env: EnvMap = process.env): string {
  return (
    env[HerdrEnv.SocketPath] ||
    env[HerdrEnv.Socket] ||
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
