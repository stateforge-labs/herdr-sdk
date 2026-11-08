// Role: the small value types of the core layer: brand, fields, Result, Count, Text, time and an async queue.
// Informs HERDR-ADR-0020; merged by HERDR-ADR-0021 from brand.ts, fields.ts, result.ts, count.ts, text.ts, time.ts, async-queue.ts.
import { CoreInvariantError } from './errors.ts';
import type { ParseFailure } from './errors.ts';

declare const marker: unique symbol;

export type Brand<Carrier, Name> = Carrier & { readonly [marker]: Name };

export function brand<Carrier, Name>(carrier: Carrier): Brand<Carrier, Name> {
  return carrier as Brand<Carrier, Name>;
}

export type Fields = Readonly<Record<string, unknown>>;

export function isFields(input: unknown): input is Fields {
  return typeof input === 'object' && input !== null;
}

export type Result<T, E> = { readonly kind: 'ok'; readonly value: T } | { readonly kind: 'err'; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ kind: 'ok', value });

export const err = <E>(error: E): Result<never, E> => ({ kind: 'err', error });

export function must<T, E>(result: Result<T, E>): T {
  if (result.kind === 'err') {
    throw new CoreInvariantError(JSON.stringify(result.error));
  }
  return result.value;
}

export type Count = Brand<number, 'Count'>;
export type PositiveCount = Brand<number, 'PositiveCount'>;

export function parseCount(input: unknown): Result<Count, ParseFailure> {
  if (typeof input !== 'number') {
    return err({ kind: 'not-a-number' });
  }
  if (!Number.isInteger(input)) {
    return err({ kind: 'not-an-integer' });
  }
  if (input < 0 || !Number.isSafeInteger(input)) {
    return err({ kind: 'out-of-range' });
  }
  return ok(brand<number, 'Count'>(input));
}

export function parsePositiveCount(input: unknown): Result<PositiveCount, ParseFailure> {
  const count = parseCount(input);
  if (count.kind === 'err') {
    return count;
  }
  if (count.value === 0) {
    return err({ kind: 'out-of-range' });
  }
  return ok(brand<number, 'PositiveCount'>(count.value));
}

export type Text = Brand<string, 'Text'>;
export type NonEmptyText = Brand<string, 'NonEmptyText'>;

export function parseText(input: unknown): Result<Text, ParseFailure> {
  if (typeof input !== 'string') {
    return err({ kind: 'not-a-string' });
  }
  return ok(brand<string, 'Text'>(input));
}

export function parseNonEmptyText(input: unknown): Result<NonEmptyText, ParseFailure> {
  const text = parseText(input);
  if (text.kind === 'err') {
    return text;
  }
  if (text.value.trim() === '') {
    return err({ kind: 'empty' });
  }
  return ok(brand<string, 'NonEmptyText'>(text.value));
}

export type Instant = Brand<number, 'Instant'>;
export type Duration = Brand<number, 'Duration'>;

export function instant(ms: number): Instant {
  return ms as Instant;
}

export function duration(ms: number): Duration {
  return ms as Duration;
}

export function elapsed(from: Instant, to: Instant): Duration {
  return duration(Math.max(0, to - from));
}

export type Milliseconds = Brand<number, 'Milliseconds'>;

export function parseMilliseconds(input: unknown): Result<Milliseconds, ParseFailure> {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    return err({ kind: 'not-a-number' });
  }
  if (input < 0) {
    return err({ kind: 'out-of-range' });
  }
  return ok(brand<number, 'Milliseconds'>(input));
}

export function parseInstant(input: unknown): Result<Instant, ParseFailure> {
  const ms = parseMilliseconds(input);
  if (ms.kind === 'err') {
    return ms;
  }
  return ok(brand<number, 'Instant'>(ms.value));
}

export function parseDuration(input: unknown): Result<Duration, ParseFailure> {
  const ms = parseMilliseconds(input);
  if (ms.kind === 'err') {
    return ms;
  }
  return ok(brand<number, 'Duration'>(ms.value));
}

export class AsyncQueue<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private readonly waiters: ((result: IteratorResult<T>) => void)[] = [];
  private ended = false;

  push(item: T): void {
    if (this.ended) {
      return;
    }
    const wake = this.waiters.shift();
    if (wake === undefined) {
      this.items.push(item);
      return;
    }
    wake({ value: item, done: false });
  }

  end(): void {
    this.ended = true;
    for (const wake of this.waiters.splice(0)) {
      wake({ value: undefined, done: true });
    }
  }

  private next(): Promise<IteratorResult<T>> {
    if (this.items.length > 0) {
      return Promise.resolve({ value: this.items.shift() as T, done: false });
    }
    if (this.ended) {
      return Promise.resolve({ value: undefined, done: true });
    }
    return new Promise<IteratorResult<T>>((resolve) => { this.waiters.push(resolve); });
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return { next: (): Promise<IteratorResult<T>> => this.next() };
  }
}
