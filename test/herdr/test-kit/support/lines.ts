// Role: a raw node:net client that stays connected and collects each complete line as it arrives, for tests that read an ack or a push before the server closes.
// Informs HERDR-ADR-0016 (W2: the ack and the pushes after it arrive on one open connection) and plan 5; new test helper for test/test-kit.
import { createConnection, type Socket } from 'node:net';
import { LINE_SEPARATOR, TEXT_ENCODING } from '../../../../src/constants.ts';
import { LineSplitter } from '../../../../src/herdr/wire/line-splitter.ts';
import { waitUntil } from '../../../support/wait.ts';

const WAIT_MS = 1000;

export interface LineReader {
  // Every complete line received so far, in order.
  readonly lines: readonly string[];
  // Resolves once the connection has closed, from either side.
  readonly closed: Promise<void>;
  write(line: string): void;
  destroy(): void;
}

export function openLineReader(path: string): LineReader {
  const socket: Socket = createConnection({ path });
  const splitter = new LineSplitter();
  const lines: string[] = [];
  const closed = new Promise<void>((resolve) => {
    socket.on('close', () => {
      resolve();
    });
  });
  socket.setEncoding(TEXT_ENCODING);
  socket.on('error', () => undefined);
  socket.on('data', (chunk: string) => {
    lines.push(...splitter.push(chunk));
  });
  return {
    lines,
    closed,
    write(line) {
      socket.write(`${line}${LINE_SEPARATOR}`);
    },
    destroy() {
      socket.destroy();
    },
  };
}

// Waits until the reader holds at least `count` lines, then returns all of them.
export async function linesAtLeast(reader: LineReader, count: number): Promise<readonly string[]> {
  await waitUntil(() => reader.lines.length >= count, WAIT_MS);
  return reader.lines;
}
