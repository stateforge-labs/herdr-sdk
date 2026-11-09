// Role: every literal the library uses outside the generated modules, as as-const objects; no consumers in phase 1b.
// Informs HERDR-ADR-0003 (layering) and plan section 3 ("every literal lives in constants.ts"), 3.1, 3.3 and 3.6.
import { ServerCapability, SubscriptionType } from './herdr/generated/index.ts';
import type { ServerCapabilities } from './herdr/generated/results.ts';

export { TOKEN_NAME_PATTERN } from './herdr/generated/names/token-name-pattern.ts';

// Environment variable names and the default socket location.
export const HerdrEnv = {
  Socket: 'HERDR_SOCKET',
  Home: 'HOME',
  Live: 'HERDR_LIVE',
} as const;

// Path parts of the default herdr socket, ~/.config/herdr/herdr.sock.
export const SocketPathPart = {
  ConfigDir: '.config',
  HerdrDir: 'herdr',
  SocketFile: 'herdr.sock',
} as const;

// Request timeout and the margin added to a long-poll timeout (plan 3.3 gives 10 s; the margin is new, the owner may tune it).
export const Timeout = {
  DefaultMs: 10_000,
  LongPollMarginMs: 5_000,
} as const;

// Reconnect backoff for held and subscription connections.
export const Backoff = {
  InitialMs: 1_000,
  MaxMs: 30_000,
  Factor: 2,
  // A connection that stayed up this long resets the backoff to InitialMs.
  StableResetMs: 60_000,
} as const;

// Protocol compatibility policy: exact match by default, minimum is optional.
export const ProtocolPolicy = {
  Exact: 'exact',
  Minimum: 'minimum',
} as const;
export type ProtocolPolicy = (typeof ProtocolPolicy)[keyof typeof ProtocolPolicy];

// Queue overflow behaviour of a subscription (plan 3.6).
export const Overflow = {
  DropOldest: 'drop-oldest',
  Fail: 'fail',
} as const;
export type Overflow = (typeof Overflow)[keyof typeof Overflow];

// Kinds of watch handle (plan 3.6; hand-kept, not generated).
export const WatchKind = {
  Live: 'live',
  Frame: 'frame',
} as const;
export type WatchKind = (typeof WatchKind)[keyof typeof WatchKind];

// Keys of PRESET_METHODS in names.ts.
export const Presets = {
  SessionsReader: 'SessionsReader',
} as const;
export type Preset = (typeof Presets)[keyof typeof Presets];

// Prefix of subscription request ids.
export const SUBSCRIBE_ID_PREFIX = 'sub';

// Error message builders; functions, so the wording lives in one place.
export const ErrorText = {
  NoAck: (ms: number): string => `no ack within ${ms}ms`,
  Unavailable: (method: string, what: string): string => `${method}: ${what}`,
  NoResponse: (method: string, ms: number): string => `${method}: no response within ${ms}ms`,
  Aborted: (method: string): string => `${method}: aborted`,
  Unparseable: (method: string): string => `${method}: unparseable response`,
  ClosedBeforeResponse: (method: string): string => `${method}: connection closed before a response`,
  ClientClosed: (method: string): string => `${method}: client is closed`,
  SocketError: (method: string): string => `${method}: socket error`,
  CannotConnect: (path: string): string => `cannot connect to herdr socket at ${path}`,
  NoSocket: (path: string): string => `no herdr socket at ${path}`,
  ProtocolMismatch: (expected: number, actual: number): string =>
    `herdr protocol ${actual} is not supported (expected ${expected})`,
  Unsupported: (method: string, capability: string): string => `${method}: server lacks capability ${capability}`,
  Refused: (method: string, message: string, code: string): string => `${method}: ${message} [${code}]`,
  SubscriptionEnded: (method: string): string => `${method}: the server closed the subscription`,
  NotImplemented: (what: string, lane: string): string => `${what} is not implemented yet (owned by lane ${lane}, HERDR-ADR-0017)`,
  NotAllowed: (method: string): string => `${method}: not allowed on this client`,
} as const;

// Error class names, set as `name` on each wire error class (so the names are not typed twice).
export const ErrorName = {
  Herdr: 'HerdrError',
  Transport: 'HerdrTransportError',
  ProtocolMismatch: 'ProtocolMismatchError',
  UnsupportedByServer: 'UnsupportedByServerError',
  SubscriptionEnded: 'SubscriptionEnded',
  NotImplemented: 'NotImplementedError',
  MalformedSchema: 'MalformedSchemaError',
  UnsupportedWatch: 'UnsupportedWatchError',
} as const;

// Codes of a HerdrError (error.code), as herdr sends them. The schema types ErrorBody.code as a bare string, so these are hand-kept; unknown codes stay strings.
export const ErrorCode = {
  AgentBlocked: 'agent_blocked',
  AgentNotFound: 'agent_not_found',
  AgentPromptStalled: 'agent_prompt_stalled',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// JSON field names of the NDJSON wire envelopes.
export const WireField = {
  Id: 'id',
  Method: 'method',
  Params: 'params',
  Result: 'result',
  Error: 'error',
  Code: 'code',
  Message: 'message',
  Type: 'type',
  Protocol: 'protocol',
  Version: 'version',
  Capabilities: 'capabilities',
  Event: 'event',
} as const;

// Prefix of request ids The id is an echo, not a correlation key (HERDR-ADR-0016 W1).
export const REQUEST_ID_PREFIX = 'sdk';

// Id herdr returns for an unparseable request, followed by a close (HERDR-ADR-0016 W3).
export const EMPTY_REPLY_ID = '';

// One NDJSON line ends with a newline.
export const LINE_SEPARATOR = '\n';

// Socket text encoding.
export const TEXT_ENCODING = 'utf8' as const;

// Outcome of one call, reported to the onCall hook.
export const CallOutcome = {
  Answered: 'answered',
  Refused: 'refused',
  Transport: 'transport',
} as const;
export type CallOutcome = (typeof CallOutcome)[keyof typeof CallOutcome];

// Results of `typeof x`: a JSON object envelope, and a text value (the fake writes a string line as it is).
export const TypeofTag = {
  Object: 'object',
  String: 'string',
} as const;

// Test-kit facts of the minimal fake (not herdr facts). F6 and W3 values are the fake's own choice, not measured.
export const Fake = {
  DirPrefix: 'herdr-fake-',
  SocketFile: 'herdr.sock',
  Version: '0.9.5-fake',
  UnknownMethodCode: 'unknown_method',
  InvalidRequestCode: 'invalid_request',
  // Delay between the two halves of a split subscribe ack (test convenience, splitAck).
  SplitAckDelayMs: 5,
} as const;

// Texts the fake puts in its own error envelopes.
export const FakeText = {
  UnknownMethod: (method: string): string => `unknown method ${method}`,
  InvalidRequest: 'unparseable request',
} as const;

// Capabilities the fake's pong advertises when a test does not choose (the fake's own choice, not herdr's).
export const DEFAULT_CAPABILITIES: ServerCapabilities = {
  [ServerCapability.DetachedServerDaemon]: true,
  [ServerCapability.HealthCheck]: true,
  [ServerCapability.LiveHandoff]: true,
  [ServerCapability.SshAgentRegistration]: true,
  [ServerCapability.SurfaceInterest]: true,
};

// What the fake does with one request line: stay silent, write a raw line, or write an envelope.
export const AnswerKind = {
  Silent: 'silent',
  Raw: 'raw',
  Envelope: 'envelope',
} as const;
export type AnswerKind = (typeof AnswerKind)[keyof typeof AnswerKind];

// Where one fake connection stands after its last answer (test-kit only): still open for requests, answered and ended,
// a subscriber after its ack (pushes flow), or a held connection (class C; answers every request, stays open).
export const ServedState = {
  Fresh: 'fresh',
  Answered: 'answered',
  Subscriber: 'subscriber',
  Held: 'held',
} as const;
export type ServedState = (typeof ServedState)[keyof typeof ServedState];

// ---------------------------------------------------------------------------------------------
// Contract constants (HERDR-ADR-0017, docs/architecture/contracts.md). Locked: lanes read them, the architect amends them.
// ---------------------------------------------------------------------------------------------

// The `event` of a push frame whose kind this library does not know (HERDR-ADR-0016 P3). Not a herdr value, so it cannot collide.
export const UNKNOWN_EVENT = '@stateforge-labs/herdr-sdk:unknown-event' as const;

// Kinds of change watchPaneSet emits (plan 3.6, HERDR-ADR-0016 W6).
export const PaneSetKind = {
  Added: 'added',
  Removed: 'removed',
  Frame: 'frame',
} as const;
export type PaneSetKind = (typeof PaneSetKind)[keyof typeof PaneSetKind];

// Subscription types that need pane_id (HERDR-ADR-0016 W6). Not a hand copy that can drift: the contract test
// test/types/contract/subscription-lists.ts fails to compile unless this list equals PerPaneSubscriptionType exactly.
export const PER_PANE_SUBSCRIPTION_TYPES = [
  SubscriptionType.PaneOutputMatched,
  SubscriptionType.PaneAgentStatusChanged,
  SubscriptionType.PaneScrollChanged,
] as const;

// Every other subscription type: watch()'s default `subscriptions` (plan 3.6).
export const GLOBAL_SUBSCRIPTION_TYPES: readonly SubscriptionType[] = Object.values(SubscriptionType).filter(
  (type) => !(PER_PANE_SUBSCRIPTION_TYPES as readonly SubscriptionType[]).includes(type),
);

// herdr-drift exit codes (HERDR-ADR-0009; P5: could not look is 3, never 0).
export const DriftExitCode = {
  Clean: 0,
  Drift: 1,
  Usage: 2,
  NotCovered: 3,
} as const;
export type DriftExitCode = (typeof DriftExitCode)[keyof typeof DriftExitCode];

// What a schema source found (drift; HERDR-ADR-0009).
export const SchemaReadKind = {
  Found: 'found',
  NotFound: 'not-found',
  Unreadable: 'unreadable',
} as const;
export type SchemaReadKind = (typeof SchemaReadKind)[keyof typeof SchemaReadKind];

// The drift CLI outcome before its exit code (drift; HERDR-ADR-0009).
export const DriftOutcomeKind = {
  Usage: 'usage',
  NotCovered: 'not-covered',
  Report: 'report',
} as const;
export type DriftOutcomeKind = (typeof DriftOutcomeKind)[keyof typeof DriftOutcomeKind];

// _tag of each Effect error.
export const EffectErrorTag = {
  Refused: 'HerdrRefused',
  Unavailable: 'HerdrUnavailable',
  ProtocolMismatch: 'ProtocolMismatch',
  Unsupported: 'HerdrUnsupported',
} as const;
export type EffectErrorTag = (typeof EffectErrorTag)[keyof typeof EffectErrorTag];

// Measured herdr wire facts the full fake reproduces (HERDR-ADR-0016 W1-W6).
export const WireFact = {
  W1CloseAfterResponse: 'W1',
  W2AckThenStream: 'W2',
  W3EmptyIdOnUnparseable: 'W3',
  W4SchemaOverSocketIsEmpty: 'W4',
  W5NoHistoryReplay: 'W5',
  W6PerPaneNeedsPaneId: 'W6',
} as const;
export type WireFact = (typeof WireFact)[keyof typeof WireFact];

// Lanes of the parallel build (contracts.md). Used by notImplemented() so a stub names its owner.
export const Lane = {
  P2a: 'P2a',
  P2b: 'P2b',
  P3: 'P3',
  P4a: 'P4a',
  P4b: 'P4b',
  P5a: 'P5a',
  P5c: 'P5c',
  P6a: 'P6a',
} as const;
export type Lane = (typeof Lane)[keyof typeof Lane];

// ---------------------------------------------------------------------------------------------
// Lane sections: a lane adds constants ONLY between its own `--- lane Px ---` and `--- end Px ---` lines (append-only;
// contracts.md "shared files"). The blank lines between sections keep two lanes' inserts in separate merge hunks.
// ---------------------------------------------------------------------------------------------
// --- lane P2a ---

// --- end P2a ---

// --- lane P2b ---
// Entry names of the scoped clients: the keys of the generated ENTRY_METHODS table (contracts.md, client/types.ts EntryName).
export const EntryKey = {
  client: 'client',
  admin: 'admin',
  prompt: 'prompt',
  readOnly: 'readOnly',
  readOnlyContent: 'readOnlyContent',
  held: 'held',
  plugin: 'plugin',
} as const;
export type EntryKey = (typeof EntryKey)[keyof typeof EntryKey];

// Separates the segments of a method name: `agent.view.set` is the leaf `set` under `agent` then `view`.
export const METHOD_SEPARATOR = '.';

// Keys of the namespace tree that the client composes by hand (events.subscribe is not a tree leaf).
export const TreeKey = {
  Events: 'events',
  Subscribe: 'subscribe',
} as const;

// Results of `typeof` that the namespace tree tells a branch from a leaf by.
export const TypeofKind = {
  Function: 'function',
  Object: 'object',
} as const;

// --- end P2b ---

// --- lane P3 ---

// --- end P3 ---

// --- lane P4a ---

// --- end P4a ---

// --- lane P4b ---
// Messages of the watch layer (plan 3.6, HERDR-ADR-0016 W5/W6). Codes stay in ErrorName; these are the texts only.
export const WatchText = {
  ReplayOverflow: (max: number): string => `replay buffer overflowed at ${max} frames`,
  OutputMatchUnsupported:
    'watchPaneSet does not subscribe to pane.output_matched: its match and source are not options yet (HERDR-ADR-0016 open issue 8)',
} as const;

// Messages of the held connection layer (plan 3.6).
export const HeldText = {
  Ended: (method: string): string => `${method}: the held connection is closed`,
} as const;

// Subscription types that keep watchPaneSet's set of panes (W6): a pane is created or closed.
export const PANE_LIFECYCLE_SUBSCRIPTION_TYPES = [SubscriptionType.PaneCreated, SubscriptionType.PaneClosed] as const;
// --- end P4b ---

// --- lane P5a ---
// Error code the fake returns for params that break the generated shape, or a per-pane spec without pane_id (HERDR-ADR-0016 W6: herdr answers invalid_params).
export const FakeErrorCode = { InvalidParams: 'invalid_params' } as const;
// Texts of the fake's invalid_params errors.
export const FakeCheckText = {
  NotAnObject: (method: string): string => `${method}: params must be an object`,
  MissingField: (method: string, field: string): string => `${method}: missing required field ${field}`,
  WrongKind: (method: string, field: string): string => `${method}: field ${field} has the wrong type`,
  NotInEnum: (method: string, field: string): string => `${method}: field ${field} is not an allowed value`,
  KeyNotAllowed: (method: string, field: string): string => `${method}: a key of field ${field} is not allowed`,
  NeedsPaneId: (type: string): string => `${type} needs pane_id`,
} as const;
// JavaScript typeof results the request checker compares a value against (the number and boolean ones; TypeofTag has the rest).
export const TypeofValue = { Number: 'number', Boolean: 'boolean' } as const;
// The result herdr gives api.schema over the socket (HERDR-ADR-0016 W4, measured): an empty object.
export const EMPTY_SCHEMA_RESULT: Readonly<Record<string, never>> = {};
// Field names of a subscription spec (subscriptions, pane_id) that the fake reads.
export const SpecField = { Subscriptions: 'subscriptions', PaneId: 'pane_id' } as const;
// Methods the fake answers that the generated schema does not list (api.schema is not in generated Method; W4).
export const FakeMethod = { ApiSchema: 'api.schema' } as const;
// How an event kind is named as a subscription type: pane_created is subscription pane.created; a frame already named as a subscription type (pane.output_matched) keeps its name.
export const NameSeparator = { Event: '_', Subscription: '.' } as const;
// --- end P5a ---

// --- lane P5c ---

// --- end P5c ---

// --- lane P6a ---
// Message of a tagged error whose source carries no message (a thrown string, undefined, a plain object).
export const EffectFallbackMessage = {
  UnknownError: 'unknown herdr error',
} as const;

// --- end P6a ---

