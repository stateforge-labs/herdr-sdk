// Role: the onCall timing hook: the event it receives, how a failed call is classified, and a reporter that a throwing hook cannot break.
// Informs HERDR-ADR-0004 (Promise core) and plan 3.3 (onCall); outcome kinds and observe/outcomeOf ported from atalaya src/client/rpc.ts.
import { CallOutcome } from '../constants.ts';
import type { Method } from '../generated/index.ts';
import { HerdrError } from './errors.ts';

export interface CallEvent {
  readonly method: Method;
  readonly durationMs: number;
  readonly outcome: CallOutcome;
  readonly code?: string;
}

export type OnCall = (event: CallEvent) => void;

export interface CallClassification {
  readonly outcome: CallOutcome;
  readonly code?: string;
}

// A server refusal is Refused with its code; everything else (timeout, abort, socket, malformed line) is Transport.
export function outcomeOf(error: unknown): CallClassification {
  if (error instanceof HerdrError) {
    return { outcome: CallOutcome.Refused, code: error.code };
  }
  return { outcome: CallOutcome.Transport };
}

// Runs the hook; a hook that throws changes nothing about the call.
export function reportCall(onCall: OnCall | undefined, event: CallEvent): void {
  if (onCall === undefined) {
    return;
  }
  try {
    onCall(event);
  } catch {
    // The observer is best effort: the caller's result or error is never replaced by a hook failure.
  }
}
