// Role: writes NDJSON lines to a fake socket, and never crashes the fake when the client has already gone.
// Informs HERDR-ADR-0016 (W2: every line is one JSON object followed by a newline) and plan 5; test-kit only.
import type { Socket } from 'node:net';
import { LINE_SEPARATOR, TEXT_ENCODING, TypeofTag } from '../../constants.ts';

// One NDJSON line. A string is written as it is (a stray line), an object is serialised.
export function lineOf(value: object | string): string {
  const text = typeof value === TypeofTag.String ? value : JSON.stringify(value);
  return `${text}${LINE_SEPARATOR}`;
}

// A client may have destroyed its socket; a write to it must not crash the fake.
export function safeWrite(socket: Socket, text: string): void {
  try {
    socket.write(text, TEXT_ENCODING);
  } catch {
    // The client already went away; there is nobody left to write to.
  }
}

// Ends the socket from the server side; a socket that is already gone ignores it.
export function endSocket(socket: Socket): void {
  try {
    socket.end();
  } catch {
    // The client already went away; there is nothing to end.
  }
}
