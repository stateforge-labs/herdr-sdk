// Role: the package entry ("."): connect(), errors, generated constants and types, the client and stream types.
// Informs plan 3.1, 3.3 and 3.6, HERDR-ADR-0003 (entry points) and HERDR-ADR-0017 (contracts); edited only by the integration step.
export { CallOutcome, Overflow, ProtocolPolicy, UNKNOWN_EVENT, WatchKind, PaneSetKind } from './constants.ts';
export {
  AgentStatus,
  EventKind,
  Method,
  PROTOCOL,
  ResultTag,
  SCHEMA_VERSION,
  ServerCapability,
  SubscriptionType,
} from './herdr/generated/index.ts';
export type { ErrorBody, PushFrame, ResultByTag, Subscription } from './herdr/generated/index.ts';
export { connect, connectPlugin } from './herdr/client/connect.ts';
export { watchPaneSet } from './herdr/client/watch-pane-set.ts';
export type {
  CallOptions,
  Client,
  ClientCapabilities,
  ConnectOptions,
  ConnectPlugin,
  PluginClient,
  ServerInfo,
} from './herdr/client/types.ts';
export type { EventSubscription, QueueOptions, Subscribe, SubscribeOptions } from './herdr/client/subscribe.ts';
export type {
  BackoffPolicy,
  PaneSetChange,
  PaneSetSource,
  PaneSetWatch,
  Sleep,
  Watch,
  WatchChange,
  WatchFn,
  WatchOptions,
  WatchPaneSetOptions,
} from './herdr/client/watch.ts';
export type { Hold, HeldConnection, HoldOptions } from './herdr/client/held.ts';
export {
  HerdrError,
  HerdrTransportError,
  ProtocolMismatchError,
  SubscriptionEnded,
  UnsupportedByServerError,
} from './herdr/errors.ts';
export type { CallEvent, DecodedFrame, OnCall, UnknownFrame } from './herdr/wire/types.ts';
