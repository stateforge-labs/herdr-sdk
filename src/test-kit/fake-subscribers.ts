// Role: the acknowledged subscriptions: which connection subscribed to what, the push fan-out to the matching ones, the held pushes, and closing them.
// Informs HERDR-ADR-0016 (W2: pushes are id-less lines after the ack; W6: a per-pane frame reaches only its pane's spec) and plan 5 (push, holdPushes, closeSubscribers, subscriberCount); test-kit only.
import type { Socket } from 'node:net';
import { endSocket, lineOf, safeWrite } from './fake-write.ts';
import { reaches, type PushLike, type SubscriptionSpec } from './fake-subscription.ts';

export class Subscribers {
  private readonly specsBySocket = new Map<Socket, readonly SubscriptionSpec[]>();
  // Frames queued while pushes are held; undefined when pushes flow.
  private queued: PushLike[] | undefined;

  add(socket: Socket, specs: readonly SubscriptionSpec[]): void {
    this.specsBySocket.set(socket, specs);
  }

  // A connection that closed leaves the set.
  forget(socket: Socket): void {
    this.specsBySocket.delete(socket);
  }

  count(): number {
    return this.specsBySocket.size;
  }

  // Writes the frame to every matching subscription, or queues it while pushes are held.
  push(frame: PushLike): void {
    if (this.queued !== undefined) {
      this.queued.push(frame);
      return;
    }
    this.deliver(frame);
  }

  // Queues pushes until the returned release runs; release writes the queued frames in order. A second release does nothing.
  holdPushes(): () => void {
    const queue: PushLike[] = [];
    this.queued = queue;
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      this.queued = undefined;
      for (const frame of queue) {
        this.deliver(frame);
      }
    };
  }

  // Ends every subscription connection from the server side; the client sees the subscription end.
  closeAll(): void {
    for (const socket of this.specsBySocket.keys()) {
      endSocket(socket);
    }
    this.specsBySocket.clear();
  }

  private deliver(frame: PushLike): void {
    const line = lineOf(frame);
    for (const [socket, specs] of this.specsBySocket) {
      if (reaches(specs, frame)) {
        safeWrite(socket, line);
      }
    }
  }
}
