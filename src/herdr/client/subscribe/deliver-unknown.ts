// Role: hands an UnknownFrame to each hook in order (client-level first, then per-call); a hook that throws changes nothing for the stream.
// Informs HERDR-ADR-0016 (P3: an unknown kind is surfaced, never dropped) and plan 3.6 (onUnknown order); lane-internal to P4a.
import type { UnknownFrame } from '../../wire/types.ts';

export type UnknownHook = (frame: UnknownFrame) => void;

export function deliverUnknown(frame: UnknownFrame, hooks: readonly (UnknownHook | undefined)[]): void {
  for (const hook of hooks) {
    runHook(hook, frame);
  }
}

// Best effort, like reportCall: the observer's failure never reaches the consumer.
function runHook(hook: UnknownHook | undefined, frame: UnknownFrame): void {
  if (hook === undefined) {
    return;
  }
  try {
    hook(frame);
  } catch {
    // The hook is an observer; its exception is not the subscription's error.
  }
}
