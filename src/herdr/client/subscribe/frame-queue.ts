// Role: the buffer between a connection's pushes and the consumer of one subscription: a waiting next() gets a frame as soon as it arrives; a full queue applies the overflow rule.
// Informs plan 3.6 (QueueOptions: DropOldest or Fail) and HERDR-ADR-0016 (P3: a frame is never dropped without a rule); lane-internal to P4a.
import { Overflow } from '../../../constants.ts';
import { HerdrTransportError } from '../../wire/errors.ts';
import { SubscribeText } from './constants.ts';
import type { QueueOptions } from './types.ts';

const END_OF_ITERATION: IteratorReturnResult<undefined> = { done: true, value: undefined };

interface Entry<T> {
  readonly value: T;
}

interface Waiter<T> {
  readonly resolve: (result: IteratorResult<T>) => void;
  readonly reject: (reason: unknown) => void;
}

interface Failure {
  readonly reason: unknown;
}

const NO_FAIL_HOOK = (): void => undefined;

export class FrameQueue<T> {
  private readonly items: Entry<T>[] = [];
  private readonly waiters: Waiter<T>[] = [];
  private readonly max: number | undefined;
  private readonly overflow: Overflow;
  private readonly onFail: () => void;
  private ended = false;
  private failure: Failure | undefined = undefined;

  // onFail runs once, when the queue fails, so the owner can release what feeds it (the connection).
  constructor(options: QueueOptions | undefined, onFail: () => void = NO_FAIL_HOOK) {
    this.max = options?.max;
    this.overflow = options?.overflow ?? Overflow.DropOldest;
    this.onFail = onFail;
  }

  // Hands the frame to a waiting next(), or queues it; a full queue fails (Fail) or drops its oldest frame (DropOldest).
  push(value: T): void {
    if (this.isClosed()) {
      return;
    }
    const waiter = this.waiters.shift();
    if (waiter !== undefined) {
      waiter.resolve({ value, done: false });
      return;
    }
    const max = this.max;
    if (max !== undefined && this.items.length >= max) {
      if (this.overflow === Overflow.Fail) {
        this.fail(new HerdrTransportError(SubscribeText.QueueFull(max)));
        return;
      }
      this.items.shift();
    }
    this.items.push({ value });
  }

  // The next queued frame; queued frames are read before an end or a failure is seen.
  next(): Promise<IteratorResult<T>> {
    const entry = this.items.shift();
    if (entry !== undefined) {
      return Promise.resolve<IteratorResult<T>>({ value: entry.value, done: false });
    }
    if (this.failure !== undefined) {
      return Promise.reject(this.failure.reason);
    }
    if (this.ended) {
      return Promise.resolve<IteratorResult<T>>(END_OF_ITERATION);
    }
    return new Promise<IteratorResult<T>>((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }

  // No more frames: the iteration finishes normally once the queued frames are read.
  end(): void {
    if (this.isClosed()) {
      return;
    }
    this.ended = true;
    for (const waiter of this.waiters.splice(0)) {
      waiter.resolve(END_OF_ITERATION);
    }
  }

  // The iteration throws `reason` once the queued frames are read; the owner is told once so it can release the feed.
  fail(reason: unknown): void {
    if (this.isClosed()) {
      return;
    }
    this.failure = { reason };
    for (const waiter of this.waiters.splice(0)) {
      waiter.reject(reason);
    }
    this.onFail();
  }

  private isClosed(): boolean {
    return this.ended || this.failure !== undefined;
  }
}
