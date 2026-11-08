// Role: a Sleep that records each requested delay and resolves at once; the held variant waits for the signal instead.
// Informs plan 3.6 (backoff) and HERDR-ADR-0008 (no real time in tests); lane P4b test helper.
import type { Sleep } from '../../../../../src/herdr/client/watch/types.ts';

export interface RecordingSleep {
  readonly sleep: Sleep;
  readonly delays: number[];
}

export function recordingSleep(): RecordingSleep {
  const delays: number[] = [];
  const sleep: Sleep = async (ms) => {
    delays.push(ms);
  };
  return { sleep, delays };
}

// Waits until the signal aborts, as a real sleep does; the test decides when the wait is over.
export const sleepUntilAbort: Sleep = (_ms, signal) =>
  new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true });
  });

// Waits until the signal aborts, then rejects with an AbortError: how a sleep built on a rejecting timer behaves on close.
export const rejectingOnAbort: Sleep = (_ms, signal) =>
  new Promise<void>((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('the wait was aborted', 'AbortError')), { once: true });
  });
