// Role: a scripted EventSubscription: the test pushes frames, ends it normally, or fails it; close() ends it normally and records the close.
// Informs HERDR-ADR-0008 (fakes only, no socket) and plan 5; lane P4b test helper (the contract stub of watch's Subscribe).
import type { EventSubscription } from '../../../../../src/herdr/client/subscribe.ts';
import type { DecodedFrame } from '../../../../../src/herdr/wire/types.ts';

interface Ending {
  readonly failed: boolean;
  readonly error?: unknown;
}

export class ScriptedSubscription implements EventSubscription {
  closed = false;
  private readonly queue: DecodedFrame[] = [];
  private ending: Ending | undefined;
  private wake: (() => void) | undefined;

  push(frame: DecodedFrame): void {
    this.queue.push(frame);
    this.notify();
  }

  endNormally(): void {
    this.stop({ failed: false });
  }

  fail(error: unknown): void {
    this.stop({ failed: true, error });
  }

  close(): void {
    this.closed = true;
    this.endNormally();
  }

  [Symbol.asyncIterator](): AsyncIterator<DecodedFrame> {
    return {
      next: async (): Promise<IteratorResult<DecodedFrame>> => {
        for (;;) {
          const frame = this.queue.shift();
          if (frame !== undefined) {
            return { value: frame, done: false };
          }
          if (this.ending?.failed === true) {
            throw this.ending.error;
          }
          if (this.ending !== undefined) {
            return { value: undefined, done: true };
          }
          await new Promise<void>((resolve) => {
            this.wake = resolve;
          });
        }
      },
    };
  }

  private stop(ending: Ending): void {
    if (this.ending === undefined) {
      this.ending = ending;
    }
    this.notify();
  }

  private notify(): void {
    const wake = this.wake;
    this.wake = undefined;
    wake?.();
  }
}
