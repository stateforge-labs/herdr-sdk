// Role: the held connections (class C): a connection that sent a held method stays open after the answer until the test closes it.
// Informs HERDR-ADR-0016 (W1: class C methods keep the connection open; ENTRY_METHODS.held) and contracts.md open issue 1 (hold() is OPEN until phase 5b); test-kit only.
import type { Socket } from 'node:net';
import { EntryKey } from '../../constants.ts';
import { ENTRY_METHODS } from '../generated/index.ts';
import { endSocket } from './fake-write.ts';

// True for a class C method: the connection-bound ones herdr keeps open after the answer.
export function isHeldMethod(method: string): boolean {
  const heldMethods: readonly string[] = ENTRY_METHODS[EntryKey.held];
  return heldMethods.includes(method);
}

export class HeldConnections {
  private readonly sockets = new Set<Socket>();

  add(socket: Socket): void {
    this.sockets.add(socket);
  }

  // A connection that closed leaves the set.
  forget(socket: Socket): void {
    this.sockets.delete(socket);
  }

  count(): number {
    return this.sockets.size;
  }

  // Ends every held connection from the server side; the client sees its connection end.
  closeAll(): void {
    for (const socket of this.sockets) {
      endSocket(socket);
    }
    this.sockets.clear();
  }
}
