// Role: watchPaneSet(): per-pane subscriptions kept in step with pane.created / pane.closed (stub until lane P4b).
// Informs HERDR-ADR-0007, HERDR-ADR-0016 (W6) and plan 3.6; contract in client/watch/types.ts.
import { Lane } from '../../constants.ts';
import { notImplemented } from '../../not-implemented.ts';
import type { WatchPaneSet } from './types.ts';

export const watchPaneSet: WatchPaneSet = () => notImplemented('watchPaneSet', Lane.P4b);
