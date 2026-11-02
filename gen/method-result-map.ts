// Role: hand-kept seed of the method -> response tag map (25 rows ported from atalaya-bridge), each row naming its source.
// Informs HERDR-ADR-0002 and plan section 4.2. Established against herdr 0.8.2 upstream; completed in phase 3 (plan 4.2), LOOSE rules in phase 3.
export const RESULT_SOURCE = { seed: 'seed', name: 'name', docs: 'docs', recorded: 'recorded' } as const;

export type ResultSource = (typeof RESULT_SOURCE)[keyof typeof RESULT_SOURCE];

export interface ResultRow {
  readonly tag: string;
  readonly source: ResultSource;
}

export const METHOD_RESULT_SEED: Readonly<Record<string, ResultRow>> = {
  'ping': { tag: 'pong', source: RESULT_SOURCE.seed },
  'session.snapshot': { tag: 'session_snapshot', source: RESULT_SOURCE.seed },
  'workspace.create': { tag: 'workspace_created', source: RESULT_SOURCE.seed },
  'workspace.list': { tag: 'workspace_list', source: RESULT_SOURCE.seed },
  'workspace.get': { tag: 'workspace_info', source: RESULT_SOURCE.seed },
  'worktree.list': { tag: 'worktree_list', source: RESULT_SOURCE.seed },
  'worktree.create': { tag: 'worktree_created', source: RESULT_SOURCE.seed },
  'worktree.open': { tag: 'worktree_opened', source: RESULT_SOURCE.seed },
  'worktree.remove': { tag: 'worktree_removed', source: RESULT_SOURCE.seed },
  'tab.create': { tag: 'tab_created', source: RESULT_SOURCE.seed },
  'tab.list': { tag: 'tab_list', source: RESULT_SOURCE.seed },
  'tab.get': { tag: 'tab_info', source: RESULT_SOURCE.seed },
  'agent.list': { tag: 'agent_list', source: RESULT_SOURCE.seed },
  'agent.get': { tag: 'agent_info', source: RESULT_SOURCE.seed },
  'agent.read': { tag: 'pane_read', source: RESULT_SOURCE.seed },
  'agent.start': { tag: 'agent_started', source: RESULT_SOURCE.seed },
  'agent.prompt': { tag: 'agent_prompted', source: RESULT_SOURCE.seed },
  'agent.wait': { tag: 'agent_info', source: RESULT_SOURCE.seed },
  'agent.view.set': { tag: 'agent_view', source: RESULT_SOURCE.seed },
  'agent.view.clear': { tag: 'agent_view', source: RESULT_SOURCE.seed },
  'pane.list': { tag: 'pane_list', source: RESULT_SOURCE.seed },
  'pane.current': { tag: 'pane_current', source: RESULT_SOURCE.seed },
  'pane.get': { tag: 'pane_info', source: RESULT_SOURCE.seed },
  'pane.read': { tag: 'pane_read', source: RESULT_SOURCE.seed },
  'events.subscribe': { tag: 'subscription_started', source: RESULT_SOURCE.seed },
};

// Method -> response tag only (the sources stay here); emitted as METHOD_RESULT in results.ts.
export function methodResultTags(): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(METHOD_RESULT_SEED).map(([method, row]) => [method, row.tag]),
  );
}
