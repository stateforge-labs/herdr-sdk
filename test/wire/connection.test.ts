// Role: checks Connection.open and its close rules: a missing path rejects, close() half-closes, destroy() closes, onClose fires once after connecting, and a server that accepts then closes at once still settles the open.
// Informs HERDR-ADR-0016 (one request per connection, W1) and plan 3.1 (connection); new test.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ErrorText, Fake } from '../../src/constants.ts';
import { Connection, type ConnectionHandlers } from '../../src/wire/connection.ts';
import { HerdrTransportError } from '../../src/wire/errors.ts';
import { rejectionOf } from '../support/rejection.ts';
import { waitUntil } from '../support/wait.ts';
import { startRawServer, type RawServer } from './support/raw-server.ts';

const WAIT_MS = 1000;

// What a race between open() and the wait can end with; as const so tests never compare against bare strings.
const Outcome = {
  Connected: 'connected',
  Rejected: 'rejected',
  Timeout: 'timeout',
} as const;

interface Recorder extends ConnectionHandlers {
  readonly lines: string[];
  closeCount: number;
  errors: unknown[];
}

function recorder(): Recorder {
  const recorded: Recorder = {
    lines: [],
    closeCount: 0,
    errors: [],
    onLine(line) {
      recorded.lines.push(line);
    },
    onClose() {
      recorded.closeCount += 1;
    },
    onError(error) {
      recorded.errors.push(error);
    },
  };
  return recorded;
}

describe('Connection', () => {
  test('a missing socket path rejects with a cannot-connect error', async () => {
    const dir = mkdtempSync(join(tmpdir(), Fake.DirPrefix));
    const path = join(dir, 'missing.sock');
    try {
      const error = await rejectionOf(Connection.open(path, recorder()));
      assert.ok(error instanceof HerdrTransportError);
      assert.equal(error.message, ErrorText.CannotConnect(path));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // node:net reports 'connect' before a server-side close on a unix socket (probed: 200 of 200 runs, node and bun), so the
  // open resolves and the close arrives on onClose. The pre-connect close guard in Connection.open is defence in depth:
  // no socket-level test can reach it, because a close before connect is only seen after an error, and that rejects.
  test('a server that accepts then closes at once: open() connects, and the close reaches onClose once', async () => {
    const server: RawServer = await startRawServer((socket) => {
      socket.destroy();
    });
    const handlers = recorder();
    try {
      const outcome = await Promise.race([
        Connection.open(server.path, handlers).then(
          () => Outcome.Connected,
          () => Outcome.Rejected,
        ),
        delay(WAIT_MS, Outcome.Timeout),
      ]);
      assert.equal(outcome, Outcome.Connected, 'open() settles by connecting, then the close is reported');
      await waitUntil(() => handlers.closeCount === 1, WAIT_MS);
    } finally {
      await server.close();
    }
  });

  test('onClose fires once, after the open resolved, when the server closes', async () => {
    const server: RawServer = await startRawServer((socket) => {
      setTimeout(() => socket.destroy(), 20);
    });
    const handlers = recorder();
    try {
      await Connection.open(server.path, handlers);
      assert.equal(handlers.closeCount, 0);
      await waitUntil(() => handlers.closeCount === 1, WAIT_MS);
      await delay(20);
      assert.equal(handlers.closeCount, 1);
    } finally {
      await server.close();
    }
  });

  test('writeLine sends one NDJSON line and the server receives it', async () => {
    const received: string[] = [];
    const server: RawServer = await startRawServer((socket) => {
      socket.setEncoding('utf8');
      socket.on('data', (chunk: string) => {
        received.push(chunk);
      });
    });
    try {
      const connection = await Connection.open(server.path, recorder());
      connection.writeLine('{"id":"x"}');
      await waitUntil(() => received.join('').includes('\n'), WAIT_MS);
      assert.equal(received.join(''), '{"id":"x"}\n');
      connection.destroy();
    } finally {
      await server.close();
    }
  });

  test('close() half-closes: the server sees the end and can still answer', async () => {
    let sawEnd = false;
    const server: RawServer = await startRawServer((socket) => {
      socket.on('end', () => {
        sawEnd = true;
        socket.end('late\n');
      });
    });
    const handlers = recorder();
    try {
      const connection = await Connection.open(server.path, handlers);
      connection.close();
      await waitUntil(() => sawEnd, WAIT_MS);
      await waitUntil(() => handlers.closeCount === 1, WAIT_MS);
      assert.deepEqual(handlers.lines, ['late']);
    } finally {
      await server.close();
    }
  });

  test('destroy() closes the socket at once, and the server sees the close', async () => {
    let sawClose = false;
    const server: RawServer = await startRawServer((socket) => {
      socket.on('close', () => {
        sawClose = true;
      });
    });
    const handlers = recorder();
    try {
      const connection = await Connection.open(server.path, handlers);
      connection.destroy();
      await waitUntil(() => sawClose, WAIT_MS);
      await waitUntil(() => handlers.closeCount === 1, WAIT_MS);
    } finally {
      await server.close();
    }
  });
});
