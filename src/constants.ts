// Role: every literal the library uses outside the generated modules, as as-const objects; no consumers in phase 1b.
// Informs HERDR-ADR-0003 (layering) and plan section 3 ("every literal lives in constants.ts"), 3.1, 3.3 and 3.6.
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

// Error message builders, texts from hub wire.ts:70-80 (kept as functions so the wording lives in one place).
export const ErrorText = {
  NoAck: (ms: number): string => `no ack within ${ms}ms`,
  Unavailable: (method: string, what: string): string => `${method}: ${what}`,
} as const;
