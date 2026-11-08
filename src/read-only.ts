// Role: the /read-only entry: connectReadOnly(), connectPrompt(), Presets, and the read-only client types.
// Informs HERDR-ADR-0003, HERDR-ADR-0005 and HERDR-ADR-0017; edited only by the integration step.
export { connectReadOnly } from './herdr/client/scoped/connect-read-only.ts';
export { connectPrompt } from './herdr/client/scoped/connect-prompt.ts';
export { Presets, WatchKind } from './constants.ts';
export { Method, PRESET_METHODS, SubscriptionType, EventKind, AgentStatus } from './herdr/generated/index.ts';
export type {
  PromptClient,
  ReadOnlyClient,
  ReadOnlyContentClient,
  ReadOnlyOptions,
  PresetOptions,
  SessionsReaderClient,
} from './herdr/client/types.ts';
