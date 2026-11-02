// Role: the queue between a subscription and its consumer: frames pushed while the snapshot is pending are taken afterwards in arrival order.
// Informs plan 3.6 (QueueOptions: DropOldest drops the oldest item, Fail ends the stream with HerdrTransportError; unbounded without options) and HERDR-ADR-0016 (W5, replay after Live).
import { Overflow, WatchText } from '../../constants.ts';
import { HerdrTransportError } from '../../wire/errors.ts';
import type { QueueOptions } from '../subscribe/types.ts';

export interface ReplayBuffer<T> {
  /** Queues one item. Returns false once the buffer has stopped (overflow under Fail, or end/fail already ran). */
  push(item: T): boolean;
  /** Ends the buffer normally: takers get the queued items, then done. Idempotent. */
  end(): void;
  /** Ends the buffer with an error, after the queued items. Idempotent. */
  fail(error: unknown): void;
  /** The next item in arrival order. Rejects with the failure once the queue is empty; done after end() once empty. */
  take(): Promise<IteratorResult<T>>;
}

interface Ending {
  readonly failed: boolean;
  readonly error?: unknown;
}

interface Waiter<T> {
  readonly resolve: (result: IteratorResult<T>) => void;
  readonly reject: (reason: unknown) => void;
}

export function createReplayBuffer<T>(queue?: QueueOptions): ReplayBuffer<T> {
  const items: T[] = [];
  let ending: Ending | undefined;
  let waiter: Waiter<T> | undefined;

  // Serves the single waiting taker as soon as something changed: a queued item first, then the failure, then the end.
  function wake(): void {
    if (waiter === undefined) {
      return;
    }
    const pending = waiter;
    const next = items.shift();
    if (next !== undefined) {
      waiter = undefined;
      pending.resolve({ value: next, done: false });
      return;
    }
    if (ending?.failed === true) {
      waiter = undefined;
      pending.reject(ending.error);
      return;
    }
    if (ending !== undefined) {
      waiter = undefined;
      pending.resolve({ value: undefined, done: true });
    }
  }

  function stop(next: Ending): void {
    if (ending !== undefined) {
      return;
    }
    ending = next;
    wake();
  }

  return {
    push(item: T): boolean {
      if (ending !== undefined) {
        return false;
      }
      if (queue !== undefined && items.length >= queue.max) {
        if (queue.overflow === Overflow.Fail) {
          items.length = 0;
          stop({ failed: true, error: new HerdrTransportError(WatchText.ReplayOverflow(queue.max)) });
          return false;
        }
        items.shift();
      }
      items.push(item);
      wake();
      return true;
    },
    end(): void {
      stop({ failed: false });
    },
    fail(error: unknown): void {
      stop({ failed: true, error });
    },
    take(): Promise<IteratorResult<T>> {
      return new Promise<IteratorResult<T>>((resolve, reject) => {
        waiter = { resolve, reject };
        wake();
      });
    },
  };
}
