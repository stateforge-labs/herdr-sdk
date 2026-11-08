// Role: watchPaneSet(): the set of panes, one per-pane subscription each, and the replay buffer that orders their changes.
// Informs HERDR-ADR-0016, plan 3.6, HERDR-ADR-0007; merged by HERDR-ADR-0021 from pane-event.ts, pane-set.ts, per-pane-specs.ts, replay-buffer.ts, watch-pane-set.ts.
import { UNKNOWN_EVENT, PER_PANE_SUBSCRIPTION_TYPES, WatchText, Overflow, PANE_LIFECYCLE_SUBSCRIPTION_TYPES, PaneSetKind, WatchKind } from '../../constants.ts';
import { EventKind, SubscriptionType } from '../generated/index.ts';
import type { DecodedFrame } from '../wire/types.ts';
import { linkSignal, createBackoffState, resolveBackoff, defaultSleep, forwardFrames, sleepOrAbort, bareSpecs, createWatch } from './watch.ts';
import type { PerPaneSubscription, PerPaneSubscriptionType, PaneSetChange, PaneSetSource, WatchChange, WatchPaneSet, WatchPaneSetOptions } from './watch.ts';
import { UnsupportedWatchError, HerdrTransportError } from '../errors.ts';
import type { QueueOptions } from './subscribe.ts';

export interface PaneLifecycle {
  readonly event: typeof EventKind.PaneCreated | typeof EventKind.PaneClosed;
  readonly paneId: string;
}

export function lifecycleOf(frame: DecodedFrame): PaneLifecycle | undefined {
  if (frame.event === UNKNOWN_EVENT) {
    return undefined;
  }
  if (frame.event === EventKind.PaneCreated && frame.data.type === EventKind.PaneCreated) {
    return { event: EventKind.PaneCreated, paneId: frame.data.pane.pane_id };
  }
  if (frame.event === EventKind.PaneClosed && frame.data.type === EventKind.PaneClosed) {
    return { event: EventKind.PaneClosed, paneId: frame.data.pane_id };
  }
  return undefined;
}

export interface PaneSet {
  /** The pane ids now in the set. */
  ids(): string[];
  /** Adds the pane and returns its signal (aborts on remove or when the parent aborts); undefined when it was already present. */
  add(paneId: string): AbortSignal | undefined;
  /** Removes the pane and aborts its subscriptions; false when it was not in the set. */
  remove(paneId: string): boolean;
}

export function createPaneSet(parent: AbortSignal): PaneSet {
  const controllers = new Map<string, AbortController>();
  return {
    ids(): string[] {
      return [...controllers.keys()];
    },
    add(paneId: string): AbortSignal | undefined {
      if (controllers.has(paneId)) {
        return undefined;
      }
      const controller = new AbortController();
      controllers.set(paneId, controller);
      return linkSignal(controller.signal, parent);
    },
    remove(paneId: string): boolean {
      const controller = controllers.get(paneId);
      if (controller === undefined) {
        return false;
      }
      controllers.delete(paneId);
      controller.abort();
      return true;
    },
  };
}

// The per-pane types that need only pane_id (every per-pane type except pane.output_matched).
export type PaneIdOnlyType = Exclude<PerPaneSubscriptionType, typeof SubscriptionType.PaneOutputMatched>;

function isPaneIdOnly(type: PerPaneSubscriptionType): type is PaneIdOnlyType {
  return type !== SubscriptionType.PaneOutputMatched;
}

// watchPaneSet's default types: PER_PANE_SUBSCRIPTION_TYPES minus pane.output_matched (open issue 8).
export const DEFAULT_PANE_TYPES: readonly PaneIdOnlyType[] = PER_PANE_SUBSCRIPTION_TYPES.filter(isPaneIdOnly);

// Narrows the caller's types to the ones this lane can subscribe to; a pane.output_matched request is refused, not dropped.
export function checkedPaneTypes(types: readonly PerPaneSubscriptionType[]): readonly PaneIdOnlyType[] {
  return types.map((type) => {
    if (isPaneIdOnly(type)) {
      return type;
    }
    throw new UnsupportedWatchError(WatchText.OutputMatchUnsupported);
  });
}

export function perPaneSpecs(paneId: string, types: readonly PaneIdOnlyType[]): readonly PerPaneSubscription[] {
  return types.map((type) => ({ type, pane_id: paneId }));
}

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

// Everything one watchPaneSet iteration shares. `stop` ends every subscription of the iteration.
interface PaneRun {
  readonly source: PaneSetSource;
  readonly options: WatchPaneSetOptions;
  readonly types: readonly PaneIdOnlyType[];
  readonly signal: AbortSignal;
  readonly output: ReplayBuffer<PaneSetChange>;
  readonly panes: PaneSet;
  readonly stop: () => void;
}

export const watchPaneSet: WatchPaneSet = (source, options = {}) => {
  // Checked when watchPaneSet is called, so a pane.output_matched request fails at the call site, not inside the loop.
  const types = checkedPaneTypes(options.types ?? DEFAULT_PANE_TYPES);
  const controller = new AbortController();
  return {
    close(): void {
      controller.abort();
    },
    [Symbol.asyncIterator](): AsyncIterator<PaneSetChange> {
      return paneChanges(source, options, types, controller);
    },
  };
};

async function* paneChanges(
  source: PaneSetSource,
  options: WatchPaneSetOptions,
  types: readonly PaneIdOnlyType[],
  controller: AbortController,
): AsyncGenerator<PaneSetChange, void, undefined> {
  const signal = linkSignal(controller.signal, options.signal);
  const output = createReplayBuffer<PaneSetChange>();
  const endOnAbort = (): void => output.end();
  signal.addEventListener('abort', endOnAbort, { once: true });
  const run: PaneRun = {
    source,
    options,
    types,
    signal,
    output,
    panes: createPaneSet(signal),
    stop: () => controller.abort(),
  };
  followLifecycle(run);
  try {
    for (;;) {
      const next = await output.take();
      if (next.done === true || signal.aborted) {
        return;
      }
      yield next.value;
    }
  } finally {
    signal.removeEventListener('abort', endOnAbort);
    controller.abort();
  }
}

// The lifecycle is a watch over pane.created and pane.closed; its snapshot is the list of pane ids.
function followLifecycle(run: PaneRun): void {
  const lifecycle = createWatch(run.source.events.subscribe)({
    snapshot: async (): Promise<readonly string[]> => (await run.source.pane.list()).panes.map((pane) => pane.pane_id),
    subscriptions: bareSpecs(PANE_LIFECYCLE_SUBSCRIPTION_TYPES),
    backoff: run.options.backoff,
    sleep: run.options.sleep,
    signal: run.signal,
    onUnknown: run.options.onUnknown,
  });
  void pumpLifecycle(lifecycle, run);
}

// The lifecycle ends only when the iteration is closed or the client closed; either way every pane stops with it.
async function pumpLifecycle(lifecycle: AsyncIterable<WatchChange<readonly string[]>>, run: PaneRun): Promise<void> {
  try {
    for await (const change of lifecycle) {
      applyChange(change, run);
    }
  } finally {
    run.stop();
  }
}

function applyChange(change: WatchChange<readonly string[]>, run: PaneRun): void {
  if (change.kind === WatchKind.Live) {
    syncPanes(change.snapshot, run);
    return;
  }
  const lifecycle = lifecycleOf(change.frame);
  if (lifecycle === undefined) {
    return;
  }
  if (lifecycle.event === EventKind.PaneCreated) {
    addPane(lifecycle.paneId, run);
  } else {
    removePane(lifecycle.paneId, run);
  }
}

// After a Live the set equals the listed panes: missing ones are added, panes no longer listed are removed.
function syncPanes(listed: readonly string[], run: PaneRun): void {
  const current = run.panes.ids();
  for (const paneId of listed) {
    addPane(paneId, run);
  }
  for (const paneId of current) {
    if (!listed.includes(paneId)) {
      removePane(paneId, run);
    }
  }
}

function addPane(paneId: string, run: PaneRun): void {
  const paneSignal = run.panes.add(paneId);
  if (paneSignal === undefined) {
    return;
  }
  run.output.push({ kind: PaneSetKind.Added, paneId });
  void followPane(paneId, paneSignal, run);
}

function removePane(paneId: string, run: PaneRun): void {
  if (run.panes.remove(paneId)) {
    run.output.push({ kind: PaneSetKind.Removed, paneId });
  }
}

// One pane's subscription. A failure resubscribes that pane with backoff while it is still in the set. A normal end that this pane did not ask for means the client closed, so the whole set stops.
// A Sleep that fails for a reason other than the abort is passed to the consumer's iterator, never left as an unhandled rejection.
async function followPane(paneId: string, paneSignal: AbortSignal, run: PaneRun): Promise<void> {
  const backoff = createBackoffState(resolveBackoff(run.options.backoff), Date.now);
  const sleep = run.options.sleep ?? defaultSleep;
  try {
    while (!paneSignal.aborted) {
      backoff.startCycle();
      try {
        await runPaneSubscription(paneId, paneSignal, run);
        if (!paneSignal.aborted) {
          run.stop();
        }
        return;
      } catch {
        if (paneSignal.aborted) {
          return;
        }
        await sleepOrAbort(sleep, backoff.delayAfterFailure(), paneSignal);
      }
    }
  } catch (error) {
    run.output.fail(error);
  }
}

// One subscribe and its frames until the subscription ends. Resolves on a normal end; rejects when the subscribe or the subscription failed.
async function runPaneSubscription(paneId: string, paneSignal: AbortSignal, run: PaneRun): Promise<void> {
  const subscription = await run.source.events.subscribe(perPaneSpecs(paneId, run.types), {
    signal: paneSignal,
    queue: run.options.queue,
    onUnknown: run.options.onUnknown,
  });
  try {
    await forwardFrames(subscription, (frame: DecodedFrame) => run.output.push({ kind: PaneSetKind.Frame, paneId, frame }));
  } finally {
    subscription.close();
  }
}
