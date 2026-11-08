// Role: drains one subscription into a sink until the subscription ends, the sink refuses a frame, or the subscription fails (the error is rethrown to the caller).
// Informs HERDR-ADR-0016 (W2: the stream is the subscription's own) and plan 3.6; used by watch-cycle.ts and watch-pane-set.ts.
import type { DecodedFrame } from '../../wire/types.ts';
import type { EventSubscription } from '../subscribe/types.ts';

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
