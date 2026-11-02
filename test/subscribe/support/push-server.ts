// Role: a test-local herdr stand-in on node:net in a temp directory: it answers each request line through a handler, writes lines (whole or split), and closes connections on request.
// Informs HERDR-ADR-0008 (fakes only, never herdr's socket) and HERDR-ADR-0016 (W1 one answer per connection, W2 ack then id-less pushes, W3 id ""); replaced by P5a's fake.push/splitAck/strayLine after integration.
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LINE_SEPARATOR, TEXT_ENCODING } from '../../../src/constants.ts';
import { LineSplitter } from '../../../src/wire/line-splitter.ts';

export interface ReceivedRequest {
  readonly id: string;
  readonly method: string;
  readonly params: unknown;
}

export interface ServerConnection {
  // Writes one JSON object as one line.
  send(message: object): void;
  // Writes text as-is: a partial line, a malformed line, or several lines at once.
  writeRaw(text: string): void;
  // Ends the connection from the server side; the client sees EOF.
  close(): void;
}

export type RequestHandler = (request: ReceivedRequest, connection: ServerConnection) => void;

export interface PushServer {
  readonly path: string;
  readonly requests: ReceivedRequest[];
  // Connections the server has not seen close yet.
  openConnections(): number;
  stop(): Promise<void>;
}

export async function startPushServer(handler: RequestHandler): Promise<PushServer> {
  const dir = mkdtempSync(join(tmpdir(), 'herdr-push-'));
  const path = join(dir, 'herdr.sock');
  const requests: ReceivedRequest[] = [];
  const sockets = new Set<Socket>();
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => {
      sockets.delete(socket);
    });
    socket.on('error', () => undefined);
    serveSocket(socket, requests, handler);
  });
  await listen(server, path);
  return {
    path,
    requests,
    openConnections: () => sockets.size,
    stop: async () => {
      for (const socket of sockets) {
        socket.destroy();
      }
      await close(server);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function serveSocket(socket: Socket, requests: ReceivedRequest[], handler: RequestHandler): void {
  const splitter = new LineSplitter();
  socket.setEncoding(TEXT_ENCODING);
  socket.on('data', (chunk: string) => {
    for (const line of splitter.push(chunk)) {
      const request = parseRequest(line);
      requests.push(request);
      handler(request, connectionFor(socket));
    }
  });
}

// The request line is the client's own JSON; the test trusts its shape.
function parseRequest(line: string): ReceivedRequest {
  const parsed = JSON.parse(line) as ReceivedRequest;
  return { id: parsed.id, method: parsed.method, params: parsed.params };
}

function connectionFor(socket: Socket): ServerConnection {
  return {
    send: (message) => {
      socket.write(`${JSON.stringify(message)}${LINE_SEPARATOR}`);
    },
    writeRaw: (text) => {
      socket.write(text);
    },
    close: () => {
      socket.end();
    },
  };
}

function listen(server: Server, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(path, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}
