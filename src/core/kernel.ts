// Role: the small value types of the core layer: brand, fields, Result (with isOk/isErr), byKind dispatch, Count, Text, time and an async queue.
// Informs HERDR-ADR-0020; merged by HERDR-ADR-0021 from brand.ts, fields.ts, result.ts, count.ts, text.ts, time.ts, async-queue.ts.
import { JsType, ParseFailureKind, ResultKind } from './constants.ts';
import { CoreInvariantError } from './errors.ts';
import type { ParseFailure } from './errors.ts';

declare const marker: unique symbol;

export type Brand<Carrier, Name> = Carrier & { readonly [marker]: Name };

export function brand<Carrier, Name>(carrier: Carrier): Brand<Carrier, Name> {
  return carrier as Brand<Carrier, Name>;
}

export type Fields = Readonly<Record<string, unknown>>;

export function isNumber(input: unknown): input is number {
  return typeof input === JsType.Number;
}

export function isString(input: unknown): input is string {
  return typeof input === JsType.String;
}

export function isBoolean(input: unknown): input is boolean {
  return typeof input === JsType.Boolean;
}

export function isFields(input: unknown): input is Fields {
  return typeof input === JsType.Object && input !== null;
}

export type Ok<T> = { readonly kind: typeof ResultKind.Ok; readonly value: T };
export type Err<E> = { readonly kind: typeof ResultKind.Err; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Result<T, never> => ({ kind: ResultKind.Ok, value });

export const err = <E>(error: E): Result<never, E> => ({ kind: ResultKind.Err, error });

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.kind === ResultKind.Ok;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.kind === ResultKind.Err;
}

// One handler per kind of a tagged union, so a dispatch is a lookup instead of a chain of comparisons.
export type KindOf<U> = U extends { readonly kind: infer K extends string } ? K : never;

export type KindMap<U extends { readonly kind: string }, R, C = undefined> = {
  readonly [K in KindOf<U>]: (value: Extract<U, { readonly kind: K }>, context: C) => R;
};

export function byKind<U extends { readonly kind: string }, R, C = undefined>(map: KindMap<U, R, C>, value: U, context: C): R {
  const handle = map[value.kind as KindOf<U>] as (value: U, context: C) => R;
  return handle(value, context);
}

export function must<T, E>(result: Result<T, E>): T {
  if (isErr(result)) {
    throw new CoreInvariantError(JSON.stringify(result.error));
  }
  return result.value;
}

export type Count = Brand<number, 'Count'>;
export type PositiveCount = Brand<number, 'PositiveCount'>;

export function parseCount(input: unknown): Result<Count, ParseFailure> {
  if (!isNumber(input)) {
    return err({ kind: ParseFailureKind.NotANumber });
  }
  if (!Number.isInteger(input)) {
    return err({ kind: ParseFailureKind.NotAnInteger });
  }
  if (input < 0 || !Number.isSafeInteger(input)) {
    return err({ kind: ParseFailureKind.OutOfRange });
  }
  return ok(brand<number, 'Count'>(input));
}

export function parsePositiveCount(input: unknown): Result<PositiveCount, ParseFailure> {
  const count = parseCount(input);
  if (isErr(count)) {
    return count;
  }
  if (count.value === 0) {
    return err({ kind: ParseFailureKind.OutOfRange });
  }
  return ok(brand<number, 'PositiveCount'>(count.value));
}

export type Text = Brand<string, 'Text'>;
export type NonEmptyText = Brand<string, 'NonEmptyText'>;

export function parseText(input: unknown): Result<Text, ParseFailure> {
  if (!isString(input)) {
    return err({ kind: ParseFailureKind.NotAString });
  }
  return ok(brand<string, 'Text'>(input));
}

export function parseNonEmptyText(input: unknown): Result<NonEmptyText, ParseFailure> {
  const text = parseText(input);
  if (isErr(text)) {
    return text;
  }
  if (text.value.trim().length === 0) {
    return err({ kind: ParseFailureKind.Empty });
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
  if (!isNumber(input) || !Number.isFinite(input)) {
    return err({ kind: ParseFailureKind.NotANumber });
  }
  if (input < 0) {
    return err({ kind: ParseFailureKind.OutOfRange });
  }
  return ok(brand<number, 'Milliseconds'>(input));
}

export function parseInstant(input: unknown): Result<Instant, ParseFailure> {
  const ms = parseMilliseconds(input);
  if (isErr(ms)) {
    return ms;
  }
  return ok(brand<number, 'Instant'>(ms.value));
}

export function parseDuration(input: unknown): Result<Duration, ParseFailure> {
  const ms = parseMilliseconds(input);
  if (isErr(ms)) {
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
