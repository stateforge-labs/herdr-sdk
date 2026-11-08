// Role: CONTRACT of watch() and watchPaneSet() (Promise twin): change kinds, options (subscriptions, queue overflow, backoff), and the factories.
// Informs HERDR-ADR-0017 (locked seam; read-only for every lane), HERDR-ADR-0007, HERDR-ADR-0016 (W5 snapshot first, W6 per-pane) and plan 3.6.
import type { PaneSetKind, WatchKind } from '../../../constants.ts';
import type { Method, Subscription } from '../../generated/index.ts';
import type { MethodPaneList } from '../../generated/names/method.ts';
import type { DecodedFrame, ParamsOf, ResultOf, UnknownFrame } from '../../wire/types.ts';
import type { EventSubscription, QueueOptions, Subscribe } from '../subscribe/types.ts';

/** `Live` carries a fresh snapshot (first, and after every resubscribe); `Frame` a frame received after it. */
export type WatchChange<S> =
  | { readonly kind: typeof WatchKind.Live; readonly snapshot: S }
  | { readonly kind: typeof WatchKind.Frame; readonly frame: DecodedFrame };

/** Resubscribe backoff: InitialMs doubling (Factor) to MaxMs, reset after StableResetMs up (constants Backoff; hub ADR-0022). */
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
