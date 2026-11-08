// Role: the EventSubscription a caller holds: its async iterator reads the queue, and close() or leaving the loop early ends the subscription.
// Informs plan 3.6 (EventSubscription: normal end on close) and HERDR-ADR-0016 (W5: frames are changes, no replay); lane-internal to P4a.
import type { DecodedFrame } from '../../wire/types.ts';
import type { FrameQueue } from './frame-queue.ts';
import type { EventSubscription } from './types.ts';

export function subscriptionOver(queue: FrameQueue<DecodedFrame>, close: () => void): EventSubscription {
  const iterator: AsyncIterator<DecodedFrame> = {
    next: () => queue.next(),
    return: async () => {
      close();
      return { done: true, value: undefined };
    },
  };
  return {
    close,
    [Symbol.asyncIterator]: () => iterator,
  };
}
