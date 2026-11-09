// Role: hand-kept capability class of every method (102 rows), the entry-point class sets, and the SessionsReader preset.
// Informs HERDR-ADR-0005 (capability-scoped clients) and plan section 4. The generator fails on a missing or a stale row.
export const CapabilityClass = {
  RMeta: 'R-meta',
  RContent: 'R-content',
  W: 'W',
  I: 'I',
  H: 'H',
  L: 'L',
  C: 'C',
  X: 'X',
  D: 'D',
  S: 'S',
} as const;

export type CapabilityClass = (typeof CapabilityClass)[keyof typeof CapabilityClass];

export interface ClassRow {
  readonly class: CapabilityClass;
  readonly note: string;
}

const ROW = {
  rMeta: (note: string): ClassRow => ({ class: CapabilityClass.RMeta, note }),
  rContent: (note: string): ClassRow => ({ class: CapabilityClass.RContent, note }),
  w: (note: string): ClassRow => ({ class: CapabilityClass.W, note }),
  i: (note: string): ClassRow => ({ class: CapabilityClass.I, note }),
  h: (note: string): ClassRow => ({ class: CapabilityClass.H, note }),
  l: (note: string): ClassRow => ({ class: CapabilityClass.L, note }),
  c: (note: string): ClassRow => ({ class: CapabilityClass.C, note }),
  x: (note: string): ClassRow => ({ class: CapabilityClass.X, note }),
  d: (note: string): ClassRow => ({ class: CapabilityClass.D, note }),
  s: (note: string): ClassRow => ({ class: CapabilityClass.S, note }),
} as const;

// One row per method. A method appears once: duplicate keys are a compile error.
export const METHOD_CLASS: Readonly<Record<string, ClassRow>> = {
  'ping': ROW.rMeta('read-only liveness check'),
  'server.agent_manifests': ROW.rMeta('lists agent manifests, no change'),
  'session.snapshot': ROW.rMeta('reads the whole session (plan 4)'),
  'workspace.list': ROW.rMeta('reads workspaces'),
  'workspace.get': ROW.rMeta('reads one workspace'),
  'worktree.list': ROW.rMeta('reads worktrees'),
  'tab.list': ROW.rMeta('reads tabs'),
  'tab.get': ROW.rMeta('reads one tab'),
  'agent.list': ROW.rMeta('reads agents'),
  'agent.get': ROW.rMeta('reads one agent'),
  'agent.explain': ROW.rMeta('reads why an agent is in its state'),
  'pane.layout': ROW.rMeta('reads pane geometry (plan 4)'),
  'pane.process_info': ROW.rMeta('reads the pane process list (plan 4)'),
  'layout.export': ROW.rMeta('exports the layout, no change'),
  'pane.neighbor': ROW.rMeta('reads the neighbour pane id'),
  'pane.edges': ROW.rMeta('reads which edges a pane touches'),
  'pane.list': ROW.rMeta('reads panes'),
  'pane.current': ROW.rMeta('reads the focused pane'),
  'pane.get': ROW.rMeta('reads one pane'),
  'pane.link.resolve': ROW.rMeta('resolves a link without opening it'),
  'integration.list': ROW.rMeta('reads installed integrations'),
  'plugin.list': ROW.rMeta('reads installed plugins'),
  'plugin.action.list': ROW.rMeta('reads plugin actions'),
  'plugin.log.list': ROW.rMeta('reads plugin logs'),
  'workspace.report_metadata': ROW.h('reports metadata a client owns; held authority'),
  'agent.read': ROW.rContent('reads agent output, which is content'),
  'pane.read': ROW.rContent('reads pane output, which is content'),
  'pane.selection.read': ROW.rContent('reads the selected text (plan 4)'),
  'notification.show': ROW.w('shows a notification, visible change'),
  'product_announcement.dismiss': ROW.w('dismisses a product notice'),
  'release_notes.dismiss': ROW.w('dismisses release notes'),
  'workspace.create': ROW.w('creates a workspace'),
  'workspace.focus': ROW.w('changes focus'),
  'workspace.rename': ROW.w('renames a workspace'),
  'workspace.move': ROW.w('reorders workspaces'),
  'workspace.move_block': ROW.w('moves a block of workspaces'),
  'worktree.create': ROW.w('creates a worktree'),
  'worktree.open': ROW.w('opens a worktree as a workspace'),
  'tab.create': ROW.w('creates a tab'),
  'tab.focus': ROW.w('changes focus'),
  'tab.rename': ROW.w('renames a tab'),
  'tab.move': ROW.w('reorders tabs'),
  'agent.rename': ROW.w('renames an agent'),
  'agent.view.set': ROW.w('sets an agent view filter'),
  'agent.view.clear': ROW.w('clears an agent view filter'),
  'agent.focus': ROW.w('changes focus'),
  'pane.split': ROW.w('splits a pane, visible change (plan 4)'),
  'pane.swap': ROW.w('swaps panes'),
  'pane.move': ROW.w('moves a pane'),
  'pane.zoom': ROW.w('zooms a pane'),
  'layout.apply': ROW.w('owner review: layout nodes can carry command, kept W like pane.split'),
  'layout.set_split_ratio': ROW.w('changes a split ratio'),
  'pane.focus_direction': ROW.w('moves focus'),
  'pane.resize': ROW.w('resizes a pane'),
  'pane.scroll': ROW.w('scrolls a pane view'),
  'pane.clear': ROW.w('owner review: clears the screen, not a close, so W not D'),
  'pane.copy_motion': ROW.w('copy-mode motion (plan 4); W until probed'),
  'pane.copy_search': ROW.w('copy-mode search (plan 4)'),
  'pane.focus': ROW.w('changes focus'),
  'pane.rename': ROW.w('renames a pane'),
  'plugin.disable': ROW.w('disables a plugin'),
  'plugin.pane.focus': ROW.w('focuses a plugin pane'),
  'agent.send_keys': ROW.i('sends keys to an agent'),
  'agent.prompt': ROW.i('sends a prompt to an agent (plan 4); also in PROMPT_EXTRA_METHODS'),
  'pane.input.set': ROW.i('sets pane input text'),
  'pane.send_text': ROW.i('sends text to a pane'),
  'pane.send_keys': ROW.i('sends keys to a pane'),
  'pane.send_input': ROW.i('sends input to a pane'),
  'pane.report_agent': ROW.h('reports agent state; held authority'),
  'pane.report_agent_session': ROW.h('reports an agent session; held authority'),
  'pane.report_metadata': ROW.h('reports pane metadata; held authority'),
  'pane.clear_agent_authority': ROW.h('drops agent authority; held'),
  'pane.release_agent': ROW.h('releases an agent; held'),
  'agent.wait': ROW.l('long-poll on agent state'),
  'events.wait': ROW.l('long-poll on one event'),
  'pane.wait_for_output': ROW.l('long-poll on pane output'),
  'events.subscribe': ROW.l('push subscription, owns a connection (plan 4)'),
  'server.ssh_agent.register': ROW.c('connection-scoped; never in a per-request tree'),
  'client_shell.surface.set': ROW.c('connection-scoped surface interest'),
  'client.window_title.set': ROW.c('connection-scoped window title (plan 4)'),
  'client.window_title.clear': ROW.c('connection-scoped window title (plan 4)'),
  'command.invoke': ROW.x('runs a command'),
  'agent.start': ROW.x('starts a process'),
  'plugin.action.invoke': ROW.x('runs plugin code'),
  'plugin.link': ROW.x('links a plugin source'),
  'plugin.enable': ROW.x('enables plugin code'),
  'integration.install': ROW.x('installs integration code'),
  'pane.edit_scrollback': ROW.x('opens an editor on scrollback'),
  'pane.link.activate': ROW.x('activates a link, runs an action (plan 4)'),
  'plugin.pane.open': ROW.x('owner review: starts plugin code, so X'),
  'workspace.close': ROW.d('closes a workspace'),
  'worktree.remove': ROW.d('removes a worktree'),
  'tab.close': ROW.d('closes a tab'),
  'pane.close': ROW.d('closes a pane'),
  'popup.close': ROW.d('closes a popup'),
  'plugin.unlink': ROW.d('unlinks a plugin'),
  'integration.uninstall': ROW.d('uninstalls an integration'),
  'plugin.pane.close': ROW.d('closes a plugin pane'),
  'server.stop': ROW.s('stops the server'),
  'server.live_handoff': ROW.s('hands the server over'),
  'server.reload_config': ROW.s('reloads server config'),
  'server.reload_agent_manifests': ROW.s('reloads agent manifests'),
};

// Entry-point names, the keys of ENTRY_CLASSES.
export const EntryKey = {
  ReadOnly: 'readOnly',
  ReadOnlyContent: 'readOnlyContent',
  Prompt: 'prompt',
  Client: 'client',
  Admin: 'admin',
  Held: 'held',
  Plugin: 'plugin',
} as const;

// Entry-point class sets (plan 3.4). C methods are never in a per-request tree.
export const ENTRY_CLASSES = {
  readOnly: [CapabilityClass.RMeta, CapabilityClass.L],
  readOnlyContent: [CapabilityClass.RMeta, CapabilityClass.RContent, CapabilityClass.L],
  prompt: [CapabilityClass.RMeta],
  client: [CapabilityClass.RMeta, CapabilityClass.RContent, CapabilityClass.W, CapabilityClass.I, CapabilityClass.H, CapabilityClass.L],
  admin: [
    CapabilityClass.RMeta, CapabilityClass.RContent, CapabilityClass.W, CapabilityClass.I, CapabilityClass.H,
    CapabilityClass.L, CapabilityClass.X, CapabilityClass.D, CapabilityClass.S,
  ],
  held: [CapabilityClass.C],
  plugin: [
    CapabilityClass.RMeta, CapabilityClass.RContent, CapabilityClass.W, CapabilityClass.I, CapabilityClass.H, CapabilityClass.L,
  ],
} as const;

// Methods added to the prompt entry beyond its class set.
export const PROMPT_EXTRA_METHODS = ['agent.prompt'] as const;

// Plugin-author methods beyond the client class set: the plugin pane methods (classes X, W, D).
export const PLUGIN_EXTRA_METHODS = ['plugin.pane.open', 'plugin.pane.focus', 'plugin.pane.close'] as const;

// Named method subsets; every preset method must be in the readOnly entry (checked by the generator).
export const PRESETS = {
  SessionsReader: ['session.snapshot', 'agent.list', 'agent.get', 'pane.get', 'pane.list'],
} as const;

export function classOf(method: string): CapabilityClass {
  const row = Object.hasOwn(METHOD_CLASS, method) ? METHOD_CLASS[method] : undefined;
  if (row === undefined) {
    throw new Error(`unclassified method '${method}'`);
  }
  return row.class;
}

// Fails on a method with no row (missing) and on a row for a method the schema does not have (stale).
export function assertClassified(methods: readonly string[]): void {
  const listed = new Set(methods);
  const missing = methods.find((method) => !Object.hasOwn(METHOD_CLASS, method));
  if (missing !== undefined) {
    throw new Error(`unclassified method '${missing}'`);
  }
  const stale = Object.keys(METHOD_CLASS).find((method) => !listed.has(method));
  if (stale !== undefined) {
    throw new Error(`stale class row '${stale}' is not a method of the schema`);
  }
}
