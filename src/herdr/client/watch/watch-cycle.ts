// Role: one watch cycle: subscribe (the ack), drain frames into the replay buffer while the snapshot is taken, yield Live, replay the buffered frames, then yield the live frames.
// Informs HERDR-ADR-0016 (W5: the snapshot comes before any frame; W2: ack, then the held stream) and plan 3.6; the loop that repeats cycles is watch.ts.
import { WatchKind } from '../../../constants.ts';
import type { Subscription } from '../../generated/index.ts';
import type { DecodedFrame } from '../../wire/types.ts';
import type { Subscribe } from '../subscribe/types.ts';
import { forwardFrames } from './forward-frames.ts';
import { createReplayBuffer } from './replay-buffer.ts';
import type { WatchChange, WatchOptions } from './types.ts';

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
