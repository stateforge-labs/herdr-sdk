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

  // Resolves once connected. A failure or a close before connecting rejects with CannotConnect; later failures go to onError
  // and the close after connecting goes to onClose (exactly once, from the socket's own close event).
  static open(path: string, handlers: ConnectionHandlers): Promise<Connection> {
    return new Promise<Connection>((resolve, reject) => {
      const socket = createConnection({ path });
      const state: LinkState = { connected: false };
      socket.setEncoding(TEXT_ENCODING);
      attachReaders(socket, handlers, state);
      socket.on('error', (error: unknown) => {
        if (state.connected) {
          handlers.onError(error);
          return;
        }
        reject(cannotConnect(path, error));
      });
      socket.on('close', () => {
        if (!state.connected) {
          reject(cannotConnect(path, undefined));
        }
      });
      socket.on('connect', () => {
        state.connected = true;
        resolve(new Connection(socket));
      });
    });
  }

  writeLine(line: string): void {
    this.socket.write(`${line}${LINE_SEPARATOR}`);
  }

  // Half-close: ends the write side only. rpc does not use it: every call destroys its socket on exit (W1).
  close(): void {
    this.socket.end();
  }

  destroy(): void {
    this.socket.destroy();
  }
}

// Set by the connect event; read by the error and close listeners to tell a failure before connecting from one after it.
interface LinkState {
  connected: boolean;
}

function cannotConnect(path: string, cause: unknown): HerdrTransportError {
  return new HerdrTransportError(ErrorText.CannotConnect(path), { cause });
}

// Data becomes lines through a splitter; close is forwarded only once connected. The error listener is attached by open().
function attachReaders(socket: Socket, handlers: ConnectionHandlers, state: LinkState): void {
  const splitter = new LineSplitter();
  socket.on('data', (chunk: string) => {
    for (const line of splitter.push(chunk)) {
      handlers.onLine(line);
    }
  });
  socket.on('close', () => {
    if (state.connected) {
      handlers.onClose();
    }
  });
}
