// Role: writes the ack of events.subscribe, with two one-shot test switches: a split ack, and a stray line written before the ack.
// Informs HERDR-ADR-0016 (W2: the ack is {id, result: subscription_started} on the subscribing connection; W5: nothing is replayed after it) and plan 5 (splitAck, strayLine); test-kit only.
import type { Socket } from 'node:net';
import { Fake, WireField } from '../constants.ts';
import { ResultTag } from '../generated/index.ts';
import { lineOf, safeWrite } from './fake-write.ts';

export class AckSwitches {
  private splitNext = false;
  private strayNext: string | undefined;

  // The next ack is written in two chunks.
  splitNextAck(): void {
    this.splitNext = true;
  }

  // The next ack is preceded by this line.
  strayBeforeAck(line: string): void {
    this.strayNext = line;
  }

  // Writes the ack of the subscription with this request id, applying each switch once.
  acknowledge(socket: Socket, id: string): void {
    const ack = lineOf({
      [WireField.Id]: id,
      [WireField.Result]: { [WireField.Type]: ResultTag.SubscriptionStarted },
    });
    const text = `${this.takeStray()}${ack}`;
    if (this.takeSplit()) {
      writeSplit(socket, text);
    } else {
      safeWrite(socket, text);
    }
  }

  private takeStray(): string {
    const line = this.strayNext;
    this.strayNext = undefined;
    return line === undefined ? '' : lineOf(line);
  }

  private takeSplit(): boolean {
    const split = this.splitNext;
    this.splitNext = false;
    return split;
  }
}

// Writes the first half now and the rest after a short delay, so the client reads a partial line first.
function writeSplit(socket: Socket, text: string): void {
  const cut = Math.floor(text.length / 2);
  safeWrite(socket, text.slice(0, cut));
  setTimeout(() => {
    safeWrite(socket, text.slice(cut));
  }, Fake.SplitAckDelayMs);
}
