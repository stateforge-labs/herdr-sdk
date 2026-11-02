// Role: one Unix-socket connection to herdr: opens it, writes NDJSON lines, reads lines through the LineSplitter and reports close and error.
// Informs HERDR-ADR-0016 (W1 one connection per request) and plan 3.1 (connection); the hub vendor copy is the base (plan appendix A.1 "take the hub copy").
import { createConnection, type Socket } from 'node:net';
import { ErrorText, LINE_SEPARATOR, TEXT_ENCODING } from '../constants.ts';
import { HerdrTransportError } from './errors.ts';
import { LineSplitter } from './line-splitter.ts';

export interface ConnectionHandlers {
  onLine(line: string): void;
  onClose(): void;
  onError(error: unknown): void;
}

export class Connection {
  private readonly socket: Socket;

  private constructor(socket: Socket) {
    this.socket = socket;
  }

  // Resolves once connected. A failure before connecting rejects with a transport error; later failures go to onError.
  static open(path: string, handlers: ConnectionHandlers): Promise<Connection> {
    return new Promise<Connection>((resolve, reject) => {
      const socket = createConnection({ path });
      let connected = false;
      socket.setEncoding(TEXT_ENCODING);
      attachReaders(socket, handlers);
      socket.on('error', (error: unknown) => {
        if (connected) {
          handlers.onError(error);
          return;
        }
        reject(new HerdrTransportError(ErrorText.CannotConnect(path), { cause: error }));
      });
      socket.on('connect', () => {
        connected = true;
        resolve(new Connection(socket));
      });
    });
  }

  writeLine(line: string): void {
    this.socket.write(`${line}${LINE_SEPARATOR}`);
  }

  // Half-close: ends the write side.
  close(): void {
    this.socket.end();
  }

  destroy(): void {
    this.socket.destroy();
  }
}

// Data becomes lines through a splitter; close is forwarded. The error listener is attached separately.
function attachReaders(socket: Socket, handlers: ConnectionHandlers): void {
  const splitter = new LineSplitter();
  socket.on('data', (chunk: string) => {
    for (const line of splitter.push(chunk)) {
      handlers.onLine(line);
    }
  });
  socket.on('close', () => {
    handlers.onClose();
  });
}
