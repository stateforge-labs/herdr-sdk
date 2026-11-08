// Role: chooses where the fake listens: the caller's socket path, or a fresh temp directory the fake removes when it stops.
// Informs plan 5 (socketPath option: default a temp dir) and HERDR-ADR-0008 (every test owns its fake and its socket); test-kit only.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Fake } from '../../constants.ts';

export interface FakeSocketLocation {
  readonly path: string;
  // The temp directory the fake created, or undefined when the caller gave the path.
  readonly ownedDir: string | undefined;
}

export function fakeSocketLocation(socketPath: string | undefined): FakeSocketLocation {
  if (socketPath !== undefined) {
    return { path: socketPath, ownedDir: undefined };
  }
  const dir = mkdtempSync(join(tmpdir(), Fake.DirPrefix));
  return { path: join(dir, Fake.SocketFile), ownedDir: dir };
}

export function removeOwnedDir(location: FakeSocketLocation): void {
  if (location.ownedDir !== undefined) {
    rmSync(location.ownedDir, { recursive: true, force: true });
  }
}
