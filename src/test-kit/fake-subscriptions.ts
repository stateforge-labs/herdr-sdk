// Role: the fake's long-lived connections: acknowledged subscribers and held connections, the push fan-out, and the switches a test flips (hold pushes, split or stray ack).
// Informs HERDR-ADR-0016 (W2 ack then id-less pushes; a held connection answers many requests) and plan 5 (push, holdPushes, splitAck, strayLine, closeSubscribers, closeHeld); test-kit only.
// Simplification: a push goes to every acknowledged subscription. Spec matching (W6) is not modelled by this fake.
import type { Socket } from 'node:net';
import { Fake, LINE_SEPARATOR, TEXT_ENCODING, TypeofTag, WireField } from '../constants.ts';
import { ResultTag } from '../generated/index.ts';

export class SubscriptionRegistry {
  private readonly subscribers = new Set<Socket>();
  private readonly held = new Set<Socket>();
  // Pushes queued while holdPushes() is active; undefined when pushes flow.
  private queued: string[] | undefined;
  private splitNextAck = false;
  private strayBeforeAck: string | undefined;

  subscriberCount(): number {
    return this.subscribers.size;
  }

  heldCount(): number {
    return this.held.size;
  }

  // Writes the ack of one events.subscribe, with the scripted stray line or split, then keeps the connection as a subscriber.
  acknowledge(socket: Socket, id: string): void {
    const ack = lineOf({
      [WireField.Id]: id,
      [WireField.Result]: { [WireField.Type]: ResultTag.SubscriptionStarted },
    });
    const stray = this.takeStray();
    const text = `${stray}${ack}`;
    this.subscribers.add(socket);
    if (this.takeSplit()) {
      writeSplit(socket, text);
    } else {
      safeWrite(socket, text);
    }
  }

  // Writes one push to every subscriber, or queues it while pushes are held.
  push(frame: object): void {
    const line = lineOf(frame);
    if (this.queued !== undefined) {
      this.queued.push(line);
      return;
    }
    this.broadcast(line);
  }

  // Queues pushes until the returned release runs; release writes the queued pushes in order.
  holdPushes(): () => void {
    const queue: string[] = [];
    this.queued = queue;
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      this.queued = undefined;
      for (const line of queue) {
        this.broadcast(line);
      }
    };
  }

  splitAck(): void {
    this.splitNextAck = true;
  }

  strayLine(line: string): void {
    this.strayBeforeAck = line;
  }

  addHeld(socket: Socket): void {
    this.held.add(socket);
  }

  closeSubscribers(): void {
    endAll(this.subscribers);
  }

  closeHeld(): void {
    endAll(this.held);
  }

  // A connection that closed (by either side) leaves both sets.
  forget(socket: Socket): void {
    this.subscribers.delete(socket);
    this.held.delete(socket);
  }

  private broadcast(line: string): void {
    for (const socket of this.subscribers) {
      safeWrite(socket, line);
    }
  }

  private takeStray(): string {
    const line = this.strayBeforeAck;
    this.strayBeforeAck = undefined;
    return line === undefined ? '' : lineOf(line);
  }

  private takeSplit(): boolean {
    const split = this.splitNextAck;
    this.splitNextAck = false;
    return split;
  }
}

// One NDJSON line. A stray line is passed as text, so it is terminated the same way.
function lineOf(value: object | string): string {
  const text = typeof value === TypeofTag.String ? value : JSON.stringify(value);
  return `${text}${LINE_SEPARATOR}`;
}

// Writes the first half now and the rest after a short delay, so the client reads a partial line first.
function writeSplit(socket: Socket, text: string): void {
  const cut = Math.floor(text.length / 2);
  safeWrite(socket, text.slice(0, cut));
  setTimeout(() => {
    safeWrite(socket, text.slice(cut));
  }, Fake.SplitAckDelayMs);
}

function endAll(sockets: Set<Socket>): void {
  for (const socket of sockets) {
    socket.end();
  }
  sockets.clear();
}

// A client may have destroyed its socket; a write to it must not crash the fake.
function safeWrite(socket: Socket, text: string): void {
  try {
    socket.write(text, TEXT_ENCODING);
  } catch {
    // The client already went away; there is nobody left to write to.
  }
}
