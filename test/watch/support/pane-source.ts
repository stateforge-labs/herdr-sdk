// Role: a PaneSetSource over a scripted Subscribe and a mutable pane list, so a test changes the listed panes between cycles.
// Informs HERDR-ADR-0016 (W6: pane.list is the snapshot of the pane set); lane P4b test helper.
import { ResultTag } from '../../../src/generated/index.ts';
import type { PaneInfo } from '../../../src/generated/events.ts';
import type { PaneSetSource } from '../../../src/client/watch/types.ts';
import type { Subscribe } from '../../../src/client/subscribe/types.ts';

export interface PaneListing {
  ids: string[];
}

export function paneSource(subscribe: Subscribe, listing: PaneListing): PaneSetSource {
  return {
    pane: {
      list: async () => ({
        type: ResultTag.PaneList,
        // A partial PaneInfo: the pane set reads only pane_id. Cast once here, as the fixture rule allows.
        panes: listing.ids.map((paneId) => ({ pane_id: paneId }) as PaneInfo),
      }),
    },
    events: { subscribe },
  };
}
