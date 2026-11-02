// Role: a raw node:net client for the fake tests: writes lines by hand and collects the lines it gets back until the server closes.
// Informs HERDR-ADR-0016 (W1 and W3 are checked on the wire, not through rpc) and plan 5 (raw socket tests); new test helper.
import { createConnection, type Socket } from 'node:net';
import { LINE_SEPARATOR, TEXT_ENCODING } from '../../src/constants.ts';
import { LineSplitter } from '../../src/wire/line-splitter.ts';

export interface RawSocket {
  write(line: string): void;
  // Resolves with every line received, once the server has closed the connection.
  untilClosed(): Promise<string[]>;
  destroy(): void;
}

export function openRawSocket(path: string): RawSocket {
  const socket: Socket = createConnection({ path });
  const splitter = new LineSplitter();
  const lines: string[] = [];
  const closed = new Promise<string[]>((resolve) => {
    socket.on('close', () => {
      resolve(lines);
    });
  });
  socket.setEncoding(TEXT_ENCODING);
  socket.on('error', () => undefined);
  socket.on('data', (chunk: string) => {
    lines.push(...splitter.push(chunk));
  });
  return {
    write(line) {
      socket.write(`${line}${LINE_SEPARATOR}`);
    },
    untilClosed() {
      return closed;
    },
    destroy() {
      socket.destroy();
    },
  };
}
