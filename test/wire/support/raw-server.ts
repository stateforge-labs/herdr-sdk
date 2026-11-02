// Role: a plain node:net server for wire tests that need a server the fake does not give (a socket the server keeps open after an answer, or one that closes at once); owns its temp directory.
// Informs HERDR-ADR-0016 (W1 is what the client must tolerate: a server that keeps the socket open) and HERDR-ADR-0008 (tests use node:net and fakes only); new test helper.
import { createServer, type Server, type Socket } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Fake } from '../../../src/constants.ts';

export interface RawServer {
  readonly path: string;
  close(): Promise<void>;
}

// Listens on a fresh socket path in a temp directory; `onConnection` is called for every accepted socket.
export function startRawServer(onConnection: (socket: Socket) => void): Promise<RawServer> {
  const dir = mkdtempSync(join(tmpdir(), Fake.DirPrefix));
  const path = join(dir, Fake.SocketFile);
  const server: Server = createServer((socket) => {
    socket.on('error', () => undefined);
    onConnection(socket);
  });
  return new Promise<RawServer>((resolve, reject) => {
    server.once('error', reject);
    server.listen(path, () => {
      resolve({
        path,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => {
              rmSync(dir, { recursive: true, force: true });
              done();
            });
          }),
      });
    });
  });
}
