// Role: waits until a condition holds, polling a few times a second, so a test can see a close that the client has only started.
// Informs plan 5 (socket tests stay small and fast; no fixed sleeps); new test helper.
import { setTimeout as delay } from 'node:timers/promises';

const POLL_MS = 5;

export async function waitUntil(condition: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error(`condition not met within ${timeoutMs}ms`);
    }
    await delay(POLL_MS);
  }
}
