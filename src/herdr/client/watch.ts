// Role: watch(): a subscription that reconnects with backoff and forwards frames until the caller stops.
// Informs HERDR-ADR-0017, HERDR-ADR-0007, HERDR-ADR-0016, plan 3.6; merged by HERDR-ADR-0021 from types.ts, default-sleep.ts, sleep-or-abort.ts, merge-signals.ts, forward-frames.ts, subscription-specs.ts, backoff.ts, watch-cycle.ts, watch.ts.
import { WatchKind, Backoff, GLOBAL_SUBSCRIPTION_TYPES } from '../../constants.ts';
import type { PaneSetKind } from '../../constants.ts';
import type { Method, Subscription, SubscriptionType } from '../generated/index.ts';
import type { MethodPaneList } from '../generated/names/method.ts';
import type { DecodedFrame, ParamsOf, ResultOf, UnknownFrame } from '../wire/types.ts';
import type { EventSubscription, QueueOptions, Subscribe } from './subscribe.ts';
import { setTimeout as delay } from 'node:timers/promises';
import { createReplayBuffer } from './watch-pane-set.ts';

/** `Live` carries a fresh snapshot (first, and after every resubscribe); `Frame` a frame received after it. */
export type WatchChange<S> =
  | { readonly kind: typeof WatchKind.Live; readonly snapshot: S }
  | { readonly kind: typeof WatchKind.Frame; readonly frame: DecodedFrame };

/** Resubscribe backoff: InitialMs doubling (Factor) to MaxMs, reset after StableResetMs up (constants Backoff). */
export interface BackoffPolicy {
  readonly initialMs: number;
  readonly maxMs: number;
  readonly factor: number;
  readonly stableResetMs: number;
}

/** Injectable wait, so tests never sleep for real. Resolves after ms, or rejects/ends early when the signal aborts. */
export type Sleep = (ms: number, signal: AbortSignal) => Promise<void>;

export interface WatchOptions<S> {
  /** Takes the present. Required: there is no subscribe-only watch (W5). */
  readonly snapshot: (signal: AbortSignal) => Promise<S>;
  /** Default: GLOBAL_SUBSCRIPTION_TYPES (constants.ts), every SubscriptionType that needs no pane_id. */
  readonly subscriptions?: readonly Subscription[] | undefined;
  readonly queue?: QueueOptions | undefined;
  readonly backoff?: Partial<BackoffPolicy> | undefined;
  readonly sleep?: Sleep | undefined;
  readonly signal?: AbortSignal | undefined;
  /** Forwarded to subscribe as SubscribeOptions.onUnknown; watch() itself never calls it (no double count). */
  readonly onUnknown?: ((frame: UnknownFrame) => void) | undefined;
}

/**
 * The watch loop: subscribe -> ack -> snapshot -> yield Live -> replay the frames that arrived between ack and snapshot
 * reply (the consumer's fold must be idempotent) -> live frames. Any close: resubscribe + resnapshot with backoff.
 * close() (or abort) ends the iteration normally. Never yields a Frame before the first Live.
 */
export interface Watch<S> extends AsyncIterable<WatchChange<S>> {
  close(): void;
}

/** `herdr.watch(options)`. Synchronous: the loop starts on the first iteration. */
export type WatchFn = <S>(options: WatchOptions<S>) => Watch<S>;

/** Builds watch() of one client from its subscribe. Implemented by client/watch/watch.ts (P4b). */
export type CreateWatch = (subscribe: Subscribe) => WatchFn;

/** The per-pane subscription specs (W6: the 3 types that need pane_id). */
export type PerPaneSubscription = Extract<Subscription, { pane_id: string }>;
export type PerPaneSubscriptionType = PerPaneSubscription['type'];

/** A pane joined or left the set, or a per-pane frame arrived for one pane. */
export type PaneSetChange =
  | { readonly kind: typeof PaneSetKind.Added; readonly paneId: string }
  | { readonly kind: typeof PaneSetKind.Removed; readonly paneId: string }
  | { readonly kind: typeof PaneSetKind.Frame; readonly paneId: string; readonly frame: DecodedFrame };

/** The smallest client watchPaneSet needs; every ReadOnlyClient, Client and AdminClient satisfies it. */
export interface PaneSetSource {
  readonly pane: { list(params?: ParamsOf<typeof MethodPaneList>): Promise<ResultOf<typeof MethodPaneList>> };
  readonly events: { subscribe: Subscribe };
}

export interface WatchPaneSetOptions {
  /** Which per-pane types to subscribe for each pane (default: PER_PANE_SUBSCRIPTION_TYPES, constants.ts). */
  readonly types?: readonly PerPaneSubscriptionType[] | undefined;
  /** Bounds each per-pane subscription's queue (passed to subscribe). */
  readonly queue?: QueueOptions | undefined;
  /** Forwarded to every per-pane subscribe as SubscribeOptions.onUnknown. */
  readonly onUnknown?: ((frame: UnknownFrame) => void) | undefined;
  readonly backoff?: Partial<BackoffPolicy> | undefined;
  readonly sleep?: Sleep | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface PaneSetWatch extends AsyncIterable<PaneSetChange> {
  close(): void;
}

/**
 * Lists panes, subscribes pane by pane to the per-pane types, and keeps the set with pane.created / pane.closed
 * (W6). Implemented by client/watch/watch-pane-set.ts (P4b); the Effect twin wraps it (P6a).
 */
export type WatchPaneSet = (source: PaneSetSource, options?: WatchPaneSetOptions) => PaneSetWatch;

/** Re-exported for implementers that hold a subscription per pane. */
export type { EventSubscription };

export const defaultSleep: Sleep = async function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  try {
    await delay(ms, undefined, { signal });
  } catch (error) {
    // The abort is the answer: the caller checks the signal and stops. Any other failure is real.
    if (!signal.aborted) {
      throw error;
    }
  }
};

export async function sleepOrAbort(sleep: Sleep, ms: number, signal: AbortSignal): Promise<void> {
  try {
    await sleep(ms, signal);
  } catch (error) {
    // The abort is the answer: the caller checks the signal and stops. Any other failure is real.
    if (!signal.aborted) {
      throw error;
    }
  }
}

// AbortSignal.any is on every target (Node >= 22.18, Bun); a missing parent just returns the own signal.
export function linkSignal(own: AbortSignal, parent: AbortSignal | undefined): AbortSignal {
  return parent === undefined ? own : AbortSignal.any([own, parent]);
}

export async function forwardFrames(
  subscription: EventSubscription,
  accept: (frame: DecodedFrame) => boolean,
): Promise<void> {
  for await (const frame of subscription) {
    if (!accept(frame)) {
      return;
    }
  }
}

// Every type given here is a bare member of Subscription (no pane_id, no match): the callers pass GLOBAL_SUBSCRIPTION_TYPES
// and PANE_LIFECYCLE_SUBSCRIPTION_TYPES, and the watch tests assert each spec has only its type.
export function bareSpecs(types: readonly SubscriptionType[]): readonly Subscription[] {
  return types.map((type) => ({ type }) as Subscription);
}

const DEFAULT_POLICY: BackoffPolicy = {
  initialMs: Backoff.InitialMs,
  maxMs: Backoff.MaxMs,
  factor: Backoff.Factor,
  stableResetMs: Backoff.StableResetMs,
};

export function resolveBackoff(partial?: Partial<BackoffPolicy>): BackoffPolicy {
  return { ...DEFAULT_POLICY, ...partial };
}

// Delay before attempt number `attempt` (0 is the first retry): InitialMs * Factor^attempt, capped at MaxMs.
export function nextDelayMs(policy: BackoffPolicy, attempt: number): number {
  return Math.min(policy.initialMs * policy.factor ** attempt, policy.maxMs);
}

export interface BackoffState {
  /** Marks the start of a cycle, so the next failure can tell whether it stayed up long enough to reset. */
  startCycle(): void;
  /** Records a failed cycle and returns the delay before the next attempt. */
  delayAfterFailure(): number;
}

// The clock is injected so tests move time instead of waiting for it. A cycle up for at least StableResetMs resets the attempt count.
export function createBackoffState(policy: BackoffPolicy, now: () => number): BackoffState {
  let attempt = 0;
  let startedAt = now();
  return {
    startCycle(): void {
      startedAt = now();
    },
    delayAfterFailure(): number {
      if (now() - startedAt >= policy.stableResetMs) {
        attempt = 0;
      }
      const delay = nextDelayMs(policy, attempt);
      attempt += 1;
      return delay;
    },
  };
}

export interface CycleInput<S> {
  readonly subscribe: Subscribe;
  readonly specs: readonly Subscription[];
  readonly options: WatchOptions<S>;
  readonly signal: AbortSignal;
}

// Returns normally when the subscription ends without failing (close, abort, or the client closed). Throws when the cycle
// failed (subscribe rejected, the snapshot rejected, or the subscription failed); the caller resubscribes after the backoff.
export async function* runCycle<S>(input: CycleInput<S>): AsyncGenerator<WatchChange<S>, void, undefined> {
  const { subscribe, specs, options, signal } = input;
  const subscription = await subscribe(specs, { signal, queue: options.queue, onUnknown: options.onUnknown });
  const buffer = createReplayBuffer<DecodedFrame>(options.queue);
  const endOnAbort = (): void => buffer.end();
  signal.addEventListener('abort', endOnAbort, { once: true });
  void forwardFrames(subscription, (frame) => buffer.push(frame)).then(
    () => buffer.end(),
    (error: unknown) => buffer.fail(error),
  );
  try {
    const snapshot = await options.snapshot(signal);
    if (signal.aborted) {
      return;
    }
    yield { kind: WatchKind.Live, snapshot };
    for (;;) {
      const next = await buffer.take();
      if (next.done === true || signal.aborted) {
        return;
      }
      yield { kind: WatchKind.Frame, frame: next.value };
    }
  } finally {
    signal.removeEventListener('abort', endOnAbort);
    subscription.close();
  }
}

const DEFAULT_SPECS = bareSpecs(GLOBAL_SUBSCRIPTION_TYPES);

export const createWatch: CreateWatch = (subscribe) => createWatchWithClock(subscribe, Date.now);

// The clock is a parameter so the backoff reset (a cycle up for stableResetMs) is tested with a fake clock. The client uses Date.now.
export function createWatchWithClock(subscribe: Subscribe, now: () => number): WatchFn {
  return function watch<S>(options: WatchOptions<S>): Watch<S> {
    const controller = new AbortController();
    const signal = linkSignal(controller.signal, options.signal);
    return {
      close(): void {
        controller.abort();
      },
      [Symbol.asyncIterator](): AsyncIterator<WatchChange<S>> {
        return watchLoop(subscribe, options, signal, now);
      },
    };
  };
}

// Repeats cycles until one ends normally. A failure sleeps the backoff delay (unless the signal already aborted) and tries again.
async function* watchLoop<S>(
  subscribe: Subscribe,
  options: WatchOptions<S>,
  signal: AbortSignal,
  now: () => number,
): AsyncGenerator<WatchChange<S>, void, undefined> {
  const backoff = createBackoffState(resolveBackoff(options.backoff), now);
  const sleep = options.sleep ?? defaultSleep;
  const specs = options.subscriptions ?? DEFAULT_SPECS;
  while (!signal.aborted) {
    backoff.startCycle();
    try {
      yield* runCycle({ subscribe, specs, options, signal });
      return;
    } catch {
      if (signal.aborted) {
        return;
      }
      await sleepOrAbort(sleep, backoff.delayAfterFailure(), signal);
    }
  }
}
