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
} from './generated/index.ts';
export type { ErrorBody, PushFrame, ResultByTag, Subscription } from './generated/index.ts';
export { connect } from './client/connect.ts';
export { watchPaneSet } from './client/watch/watch-pane-set.ts';
export type {
  CallOptions,
  Client,
  ClientCapabilities,
  ConnectOptions,
  ServerInfo,
} from './client/types.ts';
export type { EventSubscription, QueueOptions, Subscribe, SubscribeOptions } from './client/subscribe/types.ts';
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
} from './client/watch/types.ts';
export type { Hold, HeldConnection, HoldOptions } from './client/held/types.ts';
export {
  HerdrError,
  HerdrTransportError,
  ProtocolMismatchError,
  SubscriptionEnded,
  UnsupportedByServerError,
} from './wire/errors.ts';
export type { CallEvent, DecodedFrame, OnCall, UnknownFrame } from './wire/types.ts';
