// Role: reads the pane a pane.created or pane.closed frame is about; any other frame gives undefined.
// Informs HERDR-ADR-0016 (W6: created and closed keep the set) and plan 3.6; compares against the generated EventKind names, never a literal.
import { UNKNOWN_EVENT } from '../../../constants.ts';
import { EventKind } from '../../generated/index.ts';
import type { DecodedFrame } from '../../wire/types.ts';

export interface PaneLifecycle {
  readonly event: typeof EventKind.PaneCreated | typeof EventKind.PaneClosed;
  readonly paneId: string;
}

export function lifecycleOf(frame: DecodedFrame): PaneLifecycle | undefined {
  if (frame.event === UNKNOWN_EVENT) {
    return undefined;
  }
  if (frame.event === EventKind.PaneCreated && frame.data.type === EventKind.PaneCreated) {
    return { event: EventKind.PaneCreated, paneId: frame.data.pane.pane_id };
  }
  if (frame.event === EventKind.PaneClosed && frame.data.type === EventKind.PaneClosed) {
    return { event: EventKind.PaneClosed, paneId: frame.data.pane_id };
  }
  return undefined;
}
