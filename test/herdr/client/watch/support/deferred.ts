// Role: a promise the test settles by hand, so a test can push frames after the ack and before the snapshot reply.
// Informs HERDR-ADR-0016 (W5: frames between ack and snapshot); lane P4b test helper.
export interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

export function deferred<T>(): Deferred<T> {
  let resolveFn: (value: T) => void = () => undefined;
  let rejectFn: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });
  return {
    promise,
    resolve: (value: T): void => resolveFn(value),
    reject: (reason: unknown): void => rejectFn(reason),
  };
}

// Lets every queued microtask run (frames pushed to a scripted subscription are pumped in microtasks).
export function settle(): Promise<void> {
  return new Promise<void>((resolve) => setImmediate(resolve));
}
