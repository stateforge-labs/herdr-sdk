// Role: settles a held call's promise early when the caller's own signal aborts, so a call queued behind another one does not wait for its turn.
// Informs plan 3.6 (per-call signal) and contract CallOptions.signal in client/types.ts; the wire request still honours the signal on its own.

// Resolves or rejects with the work, unless the signal aborts first: then it rejects with the signal's reason at once.
export function untilAborted<T>(work: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (signal === undefined) {
    return work;
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
    }
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}
