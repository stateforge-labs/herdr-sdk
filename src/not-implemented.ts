// Role: the one helper every contract stub calls: throws NotImplementedError naming the function and the lane that owns it.
// Informs HERDR-ADR-0017 (interfaces locked before parallel implementation); removed in phase 8 once no stub is left.
import { ErrorName, ErrorText, type Lane } from './constants.ts';

// A contract function whose lane has not landed yet. Never thrown by finished code.
export class NotImplementedError extends Error {
  override readonly name: string = ErrorName.NotImplemented;
  readonly what: string;
  readonly lane: Lane;

  constructor(what: string, lane: Lane) {
    super(ErrorText.NotImplemented(what, lane));
    this.what = what;
    this.lane = lane;
  }
}

// Stub body: `return notImplemented('connectReadOnly', Lane.P2b)`.
export function notImplemented(what: string, lane: Lane): never {
  throw new NotImplementedError(what, lane);
}
