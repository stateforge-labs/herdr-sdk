// Role: every literal the library uses outside the generated modules, as as-const objects; no consumers in phase 1b.
// Informs HERDR-ADR-0003 (layering) and plan section 3 ("every literal lives in constants.ts"), 3.1, 3.3 and 3.6.
import { ServerCapability } from './generated/index.ts';
import type { ServerCapabilities } from './generated/results.ts';

export { TOKEN_NAME_PATTERN } from './generated/names.ts';

// Environment variable names and the default socket location (hub constants.ts:59; atalaya socket-path.ts).
export const HerdrEnv = {
  Socket: 'HERDR_SOCKET',
  Home: 'HOME',
  Live: 'HERDR_LIVE',
} as const;

// Path parts of the default herdr socket, ~/.config/herdr/herdr.sock (hub constants.ts:61-63).
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

// Reconnect backoff for held and subscription connections (plan 3.6; hub ADR-0022).
export const Backoff = {
  InitialMs: 1_000,
  MaxMs: 30_000,
  Factor: 2,
} as const;

// Protocol compatibility policy: exact match by default, minimum is optional (plan 3.1; hub infra/herdr/protocol-policy.ts).
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

// Kinds of watch handle (plan 3.6; hand-kept, not generated).
export const WatchKind = {
  Live: 'live',
  Frame: 'frame',
} as const;

// Keys of PRESET_METHODS in names.ts.
export const Presets = {
  SessionsReader: 'SessionsReader',
} as const;

// Prefix of subscription request ids (hub wire.ts:68).
export const SUBSCRIBE_ID_PREFIX = 'sub';

// Error message builders, texts from hub wire.ts:70-80 and atalaya rpc.ts (kept as functions so the wording lives in one place).
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
} as const;

// Error class names, set as `name` on each wire error class (so the names are not typed twice).
export const ErrorName = {
  Herdr: 'HerdrError',
  Transport: 'HerdrTransportError',
  ProtocolMismatch: 'ProtocolMismatchError',
  UnsupportedByServer: 'UnsupportedByServerError',
} as const;

// JSON field names of the NDJSON wire envelopes (hub wire.ts HerdrWireField).
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

// Prefix of request ids (atalaya protocol/id.ts). The id is an echo, not a correlation key (HERDR-ADR-0016 W1).
export const REQUEST_ID_PREFIX = 'sdk';

// Id herdr returns for an unparseable request, followed by a close (HERDR-ADR-0016 W3).
export const EMPTY_REPLY_ID = '';

// One NDJSON line ends with a newline.
export const LINE_SEPARATOR = '\n';

// Socket text encoding.
export const TEXT_ENCODING = 'utf8' as const;

// Outcome of one call, reported to the onCall hook (atalaya RpcOutcome kinds; plan 3.3).
export const CallOutcome = {
  Answered: 'answered',
  Refused: 'refused',
  Transport: 'transport',
} as const;
export type CallOutcome = (typeof CallOutcome)[keyof typeof CallOutcome];

// Result of `typeof x`, used to recognise a JSON object envelope.
export const TypeofTag = {
  Object: 'object',
} as const;

// Test-kit facts of the minimal fake (not herdr facts). F6 and W3 values are the fake's own choice, not measured.
export const Fake = {
  DirPrefix: 'herdr-fake-',
  SocketFile: 'herdr.sock',
  Version: '0.9.5-fake',
  UnknownMethodCode: 'unknown_method',
  InvalidRequestCode: 'invalid_request',
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
