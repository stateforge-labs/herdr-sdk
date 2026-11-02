// Role: watchPaneSet(): keeps the set of panes from pane.created and pane.closed (W6), follows each pane with its own per-pane subscription, and merges Added, Removed and per-pane frames into one stream.
// Informs HERDR-ADR-0016 (W6: per-pane types need pane_id) and HERDR-ADR-0007; contract in client/watch/types.ts. The lifecycle is a watch(), so the pane.list snapshot comes before its frames and a resubscribe re-lists and diffs.
// options.queue bounds each per-pane subscription only. The merged output is unbounded: a dropped Added or Removed would leave the consumer's pane set wrong for good.
import { EventKind } from '../../generated/index.ts';
import { PANE_LIFECYCLE_SUBSCRIPTION_TYPES, PaneSetKind, WatchKind } from '../../constants.ts';
import type { DecodedFrame } from '../../wire/types.ts';
import { createBackoffState, resolveBackoff } from './backoff.ts';
import { defaultSleep } from './default-sleep.ts';
import { forwardFrames } from './forward-frames.ts';
import { linkSignal } from './merge-signals.ts';
import { createPaneSet, type PaneSet } from './pane-set.ts';
import { lifecycleOf } from './pane-event.ts';
import { checkedPaneTypes, DEFAULT_PANE_TYPES, perPaneSpecs, type PaneIdOnlyType } from './per-pane-specs.ts';
import { createReplayBuffer, type ReplayBuffer } from './replay-buffer.ts';
import { sleepOrAbort } from './sleep-or-abort.ts';
import { bareSpecs } from './subscription-specs.ts';
import { createWatch } from './watch.ts';
import type { PaneSetChange, PaneSetSource, WatchChange, WatchPaneSet, WatchPaneSetOptions } from './types.ts';

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
