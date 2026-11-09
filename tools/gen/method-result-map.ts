// Role: the complete method -> response tag map, one row per request method of schema/herdr-api.schema.json (102 rows), each row typed with its source, or LOOSE with a reason.
// Informs HERDR-ADR-0002 and plan section 4.2. Checked by tools/gen/check-result-map.ts before any output is emitted; read by the emitters and test/coverage.test.ts.
// Sources of a typed row: seed (ported from atalaya-bridge, herdr 0.8.2), name (method name with '.' -> '_' is a ResponseResult tag),
// docs (herdr documentation at the pinned version; `ref` names the file and section or source path and line), recorded (a live recording on a scratch herdr, plan 4.2 step b).
// The plugin pane rows use docs: the schema's success response and the herdr 0.9.5 binary. No row uses recorded yet. Every other method is LOOSE with a reason.
export const RESULT_SOURCE = {
  seed: 'seed',
  name: 'name',
  docs: 'docs',
  recorded: 'recorded',
} as const;

export const RESULT_KIND = { typed: 'typed', loose: 'loose' } as const;

export type ResultSource = (typeof RESULT_SOURCE)[keyof typeof RESULT_SOURCE];

// Reason on every LOOSE row that has no verified tag yet; the row becomes typed only with a docs ref or a recording (phase 5b).
const UNVERIFIED_REASON = 'tag unverified: no herdr docs on this machine for 0.9.5; ResponseResult until phase 5b records it';

// A typed row names one response tag. A loose row names no single tag (the method answers several, or its tag is unverified), so ResultOf falls back to ResponseResult; it needs a reason.
export type ResultRow =
  | { readonly kind: typeof RESULT_KIND.typed; readonly tag: string; readonly source: ResultSource; readonly ref?: string }
  | { readonly kind: typeof RESULT_KIND.loose; readonly reason: string };

export type ResultMap = Readonly<Record<string, ResultRow>>;

export const METHOD_RESULT_MAP: ResultMap = {
  'ping': { kind: RESULT_KIND.typed, tag: 'pong', source: RESULT_SOURCE.seed },
  'server.stop': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'server.live_handoff': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'server.reload_config': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'server.ssh_agent.register': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'server.agent_manifests': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'server.reload_agent_manifests': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'notification.show': { kind: RESULT_KIND.typed, tag: 'notification_show', source: RESULT_SOURCE.name },
  'product_announcement.dismiss': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'release_notes.dismiss': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'command.invoke': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'client.window_title.set': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'client.window_title.clear': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'client_shell.surface.set': { kind: RESULT_KIND.typed, tag: 'client_shell_surface_set', source: RESULT_SOURCE.name },
  'session.snapshot': { kind: RESULT_KIND.typed, tag: 'session_snapshot', source: RESULT_SOURCE.seed },
  'workspace.create': { kind: RESULT_KIND.typed, tag: 'workspace_created', source: RESULT_SOURCE.seed },
  'workspace.list': { kind: RESULT_KIND.typed, tag: 'workspace_list', source: RESULT_SOURCE.seed },
  'workspace.get': { kind: RESULT_KIND.typed, tag: 'workspace_info', source: RESULT_SOURCE.seed },
  'workspace.focus': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'workspace.rename': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'workspace.move': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'workspace.move_block': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'workspace.report_metadata': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'workspace.close': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'worktree.list': { kind: RESULT_KIND.typed, tag: 'worktree_list', source: RESULT_SOURCE.seed },
  'worktree.create': { kind: RESULT_KIND.typed, tag: 'worktree_created', source: RESULT_SOURCE.seed },
  'worktree.open': { kind: RESULT_KIND.typed, tag: 'worktree_opened', source: RESULT_SOURCE.seed },
  'worktree.remove': { kind: RESULT_KIND.typed, tag: 'worktree_removed', source: RESULT_SOURCE.seed },
  'tab.create': { kind: RESULT_KIND.typed, tag: 'tab_created', source: RESULT_SOURCE.seed },
  'tab.list': { kind: RESULT_KIND.typed, tag: 'tab_list', source: RESULT_SOURCE.seed },
  'tab.get': { kind: RESULT_KIND.typed, tag: 'tab_info', source: RESULT_SOURCE.seed },
  'tab.focus': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'tab.rename': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'tab.move': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'tab.close': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'agent.list': { kind: RESULT_KIND.typed, tag: 'agent_list', source: RESULT_SOURCE.seed },
  'agent.get': { kind: RESULT_KIND.typed, tag: 'agent_info', source: RESULT_SOURCE.seed },
  'agent.read': { kind: RESULT_KIND.typed, tag: 'pane_read', source: RESULT_SOURCE.seed },
  'agent.explain': { kind: RESULT_KIND.typed, tag: 'agent_explain', source: RESULT_SOURCE.name },
  'agent.send_keys': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'agent.rename': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'agent.view.set': { kind: RESULT_KIND.typed, tag: 'agent_view', source: RESULT_SOURCE.seed },
  'agent.view.clear': { kind: RESULT_KIND.typed, tag: 'agent_view', source: RESULT_SOURCE.seed },
  'agent.focus': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'agent.start': { kind: RESULT_KIND.typed, tag: 'agent_started', source: RESULT_SOURCE.seed },
  'agent.prompt': { kind: RESULT_KIND.typed, tag: 'agent_prompted', source: RESULT_SOURCE.seed },
  'agent.wait': { kind: RESULT_KIND.typed, tag: 'agent_info', source: RESULT_SOURCE.seed },
  'pane.split': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.swap': { kind: RESULT_KIND.typed, tag: 'pane_swap', source: RESULT_SOURCE.name },
  'pane.move': { kind: RESULT_KIND.typed, tag: 'pane_move', source: RESULT_SOURCE.name },
  'pane.zoom': { kind: RESULT_KIND.typed, tag: 'pane_zoom', source: RESULT_SOURCE.name },
  'pane.layout': { kind: RESULT_KIND.typed, tag: 'pane_layout', source: RESULT_SOURCE.name },
  'pane.process_info': { kind: RESULT_KIND.typed, tag: 'pane_process_info', source: RESULT_SOURCE.name },
  'layout.export': { kind: RESULT_KIND.typed, tag: 'layout_export', source: RESULT_SOURCE.name },
  'layout.apply': { kind: RESULT_KIND.typed, tag: 'layout_apply', source: RESULT_SOURCE.name },
  'layout.set_split_ratio': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.neighbor': { kind: RESULT_KIND.typed, tag: 'pane_neighbor', source: RESULT_SOURCE.name },
  'pane.edges': { kind: RESULT_KIND.typed, tag: 'pane_edges', source: RESULT_SOURCE.name },
  'pane.focus_direction': { kind: RESULT_KIND.typed, tag: 'pane_focus_direction', source: RESULT_SOURCE.name },
  'pane.resize': { kind: RESULT_KIND.typed, tag: 'pane_resize', source: RESULT_SOURCE.name },
  'pane.scroll': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.clear': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.edit_scrollback': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.selection.read': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.copy_motion': { kind: RESULT_KIND.typed, tag: 'pane_copy_motion', source: RESULT_SOURCE.name },
  'pane.copy_search': { kind: RESULT_KIND.typed, tag: 'pane_copy_search', source: RESULT_SOURCE.name },
  'pane.list': { kind: RESULT_KIND.typed, tag: 'pane_list', source: RESULT_SOURCE.seed },
  'pane.current': { kind: RESULT_KIND.typed, tag: 'pane_current', source: RESULT_SOURCE.seed },
  'pane.get': { kind: RESULT_KIND.typed, tag: 'pane_info', source: RESULT_SOURCE.seed },
  'pane.focus': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.input.set': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.link.activate': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.link.resolve': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.rename': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.send_text': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.send_keys': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.send_input': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.read': { kind: RESULT_KIND.typed, tag: 'pane_read', source: RESULT_SOURCE.seed },
  'pane.report_agent': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.report_agent_session': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.report_metadata': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.clear_agent_authority': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.release_agent': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.close': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'popup.close': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'events.subscribe': { kind: RESULT_KIND.typed, tag: 'subscription_started', source: RESULT_SOURCE.seed },
  'events.wait': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'pane.wait_for_output': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'integration.list': { kind: RESULT_KIND.typed, tag: 'integration_list', source: RESULT_SOURCE.name },
  'integration.install': { kind: RESULT_KIND.typed, tag: 'integration_install', source: RESULT_SOURCE.name },
  'integration.uninstall': { kind: RESULT_KIND.typed, tag: 'integration_uninstall', source: RESULT_SOURCE.name },
  'plugin.link': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'plugin.list': { kind: RESULT_KIND.typed, tag: 'plugin_list', source: RESULT_SOURCE.name },
  'plugin.unlink': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'plugin.enable': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'plugin.disable': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'plugin.action.list': { kind: RESULT_KIND.typed, tag: 'plugin_action_list', source: RESULT_SOURCE.name },
  'plugin.action.invoke': { kind: RESULT_KIND.loose, reason: UNVERIFIED_REASON },
  'plugin.log.list': { kind: RESULT_KIND.typed, tag: 'plugin_log_list', source: RESULT_SOURCE.name },
  'plugin.pane.open': { kind: RESULT_KIND.typed, tag: 'plugin_pane_opened', source: RESULT_SOURCE.docs, ref: 'schema/herdr-api.schema.json success_response plugin_pane_opened; herdr 0.9.5 ResponseResult::PluginPaneOpened' },
  'plugin.pane.focus': { kind: RESULT_KIND.typed, tag: 'plugin_pane_focused', source: RESULT_SOURCE.docs, ref: 'schema/herdr-api.schema.json success_response plugin_pane_focused; herdr 0.9.5 ResponseResult::PluginPaneFocused' },
  'plugin.pane.close': { kind: RESULT_KIND.typed, tag: 'plugin_pane_closed', source: RESULT_SOURCE.docs, ref: 'schema/herdr-api.schema.json success_response plugin_pane_closed; herdr 0.9.5 ResponseResult::PluginPaneClosed' },
};

// Method -> response tag for the typed rows only; emitted as METHOD_RESULT in results.ts.
export function methodResultTags(): Readonly<Record<string, string>> {
  const tags: Record<string, string> = {};
  for (const [method, row] of Object.entries(METHOD_RESULT_MAP)) {
    if (row.kind === RESULT_KIND.typed) {
      tags[method] = row.tag;
    }
  }
  return tags;
}

export function isLoose(row: ResultRow): boolean {
  return row.kind === RESULT_KIND.loose;
}
