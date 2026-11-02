// Role: one AbortSignal that aborts when any of its sources aborts, plus a dispose that removes the listeners it added (no leak after the subscription ends).
// Informs plan 3.6 (close(), options.signal and the client close each end a subscription) and HERDR-ADR-0007; lane-internal to P4a.
export interface CombinedSignal {
  readonly signal: AbortSignal;
  readonly dispose: () => void;
}

export function anySignal(...sources: (AbortSignal | undefined)[]): CombinedSignal {
  const controller = new AbortController();
  const attached = sources.filter(isAttached);
  const onAbort = (): void => {
    dispose();
    controller.abort();
  };
  const dispose = (): void => {
    for (const source of attached) {
      source.removeEventListener('abort', onAbort);
    }
  };
  for (const source of attached) {
    if (source.aborted) {
      onAbort();
      break;
    }
    source.addEventListener('abort', onAbort);
  }
  return { signal: controller.signal, dispose };
}

function isAttached(source: AbortSignal | undefined): source is AbortSignal {
  return source !== undefined;
}
