// Role: waits the backoff delay through the injected Sleep; an abort ends the wait normally, any other failure of the Sleep is rethrown.
// Informs plan 3.6 (close() and abort end the iteration normally, never throw) and the Sleep contract in client/watch/types.ts (a Sleep may reject when its signal aborts).
import type { Sleep } from './types.ts';

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
