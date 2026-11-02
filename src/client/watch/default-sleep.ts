// Role: the default wait between resubscribes: node timers, which end early (without an error) when the signal aborts.
// Informs plan 3.6 (backoff) and HERDR-ADR-0016 (lane P4b); contract Sleep in client/watch/types.ts.
import { setTimeout as delay } from 'node:timers/promises';
import type { Sleep } from './types.ts';

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
