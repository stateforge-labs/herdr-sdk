// Role: the set of panes watchPaneSet follows: one controller per pane, so removing a pane closes its subscription; add and remove are idempotent.
// Informs HERDR-ADR-0016 (W6) and plan 3.6; replayed created and closed frames must not double-add or double-remove.
import { linkSignal } from './merge-signals.ts';

export interface PaneSet {
  /** The pane ids now in the set. */
  ids(): string[];
  /** Adds the pane and returns its signal (aborts on remove or when the parent aborts); undefined when it was already present. */
  add(paneId: string): AbortSignal | undefined;
  /** Removes the pane and aborts its subscriptions; false when it was not in the set. */
  remove(paneId: string): boolean;
}

export function createPaneSet(parent: AbortSignal): PaneSet {
  const controllers = new Map<string, AbortController>();
  return {
    ids(): string[] {
      return [...controllers.keys()];
    },
    add(paneId: string): AbortSignal | undefined {
      if (controllers.has(paneId)) {
        return undefined;
      }
      const controller = new AbortController();
      controllers.set(paneId, controller);
      return linkSignal(controller.signal, parent);
    },
    remove(paneId: string): boolean {
      const controller = controllers.get(paneId);
      if (controller === undefined) {
        return false;
      }
      controllers.delete(paneId);
      controller.abort();
      return true;
    },
  };
}
