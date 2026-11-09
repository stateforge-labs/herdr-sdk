// Role: checks socket discovery: explicit option, then HERDR_SOCKET_PATH, then HERDR_SOCKET, then HOME/.config/herdr/herdr.sock; and the existence check.
// Informs HERDR-ADR-0003 (layers), plan 3.3 (socketPath option) and plan G9 (HERDR_SOCKET_PATH). The env is passed in, never process.env.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Fake, HerdrEnv, SocketPathPart } from '../../../src/constants.ts';
import { assertSocketExists, defaultSocketPath, resolveSocketPath } from '../../../src/herdr/wire/socket-path.ts';
import { HerdrTransportError } from '../../../src/herdr/errors.ts';

const HOME_DIR = '/home/tester';

function withTempDir(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), Fake.DirPrefix));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('resolveSocketPath', () => {
  test('an explicit socketPath option wins over HERDR_SOCKET', () => {
    const env = { [HerdrEnv.Socket]: '/from/env.sock' };
    assert.equal(resolveSocketPath({ socketPath: '/explicit.sock', env }), '/explicit.sock');
  });

  test('HERDR_SOCKET wins over the HOME default', () => {
    const env = { [HerdrEnv.Socket]: '/from/env.sock', [HerdrEnv.Home]: HOME_DIR };
    assert.equal(resolveSocketPath({ env }), '/from/env.sock');
  });

  test('without an option or HERDR_SOCKET the default is under HOME', () => {
    const env = { [HerdrEnv.Home]: HOME_DIR };
    const expected = join(HOME_DIR, SocketPathPart.ConfigDir, SocketPathPart.HerdrDir, SocketPathPart.SocketFile);
    assert.equal(resolveSocketPath({ env }), expected);
    assert.equal(defaultSocketPath(env), expected);
  });

  test('HERDR_SOCKET_PATH wins over HERDR_SOCKET', () => {
    const env = { [HerdrEnv.SocketPath]: '/plugin.sock', [HerdrEnv.Socket]: '/old.sock', [HerdrEnv.Home]: HOME_DIR };
    assert.equal(resolveSocketPath({ env }), '/plugin.sock');
  });

  test('HERDR_SOCKET still works alone', () => {
    const env = { [HerdrEnv.Socket]: '/old.sock' };
    assert.equal(defaultSocketPath(env), '/old.sock');
  });

  test('the explicit option beats HERDR_SOCKET_PATH and HERDR_SOCKET', () => {
    const env = { [HerdrEnv.SocketPath]: '/plugin.sock', [HerdrEnv.Socket]: '/old.sock' };
    assert.equal(resolveSocketPath({ socketPath: '/explicit.sock', env }), '/explicit.sock');
  });

  test('empty HERDR_SOCKET_PATH and HERDR_SOCKET fall through to the HOME default', () => {
    const env = { [HerdrEnv.SocketPath]: '', [HerdrEnv.Socket]: '', [HerdrEnv.Home]: HOME_DIR };
    const expected = join(HOME_DIR, SocketPathPart.ConfigDir, SocketPathPart.HerdrDir, SocketPathPart.SocketFile);
    assert.equal(resolveSocketPath({ env }), expected);
  });

  test('an empty HERDR_SOCKET_PATH falls through to HERDR_SOCKET', () => {
    const env = { [HerdrEnv.SocketPath]: '', [HerdrEnv.Socket]: '/old.sock' };
    assert.equal(defaultSocketPath(env), '/old.sock');
  });
});

describe('assertSocketExists', () => {
  test('throws a transport error when the path is missing', () => {
    withTempDir((dir) => {
      assert.throws(() => assertSocketExists(join(dir, 'missing.sock')), HerdrTransportError);
    });
  });

  test('throws a transport error when the path is a regular file', () => {
    withTempDir((dir) => {
      const file = join(dir, 'plain.txt');
      writeFileSync(file, 'not a socket');
      assert.throws(() => assertSocketExists(file), HerdrTransportError);
    });
  });

  test('passes when a unix socket listens at the path', async () => {
    await withListeningSocket(async (path) => {
      assert.doesNotThrow(() => assertSocketExists(path));
    });
  });
});

// Opens a real unix socket for the existence check, then closes it.
async function withListeningSocket(run: (path: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), Fake.DirPrefix));
  const path = join(dir, Fake.SocketFile);
  const server: Server = createServer();
  await new Promise<void>((resolve) => server.listen(path, resolve));
  try {
    await run(path);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
}
