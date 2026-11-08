// Role: every string and number of the herdr-core client in one place: names, environment variables, timings, wire fields, kinds, states and messages.
// Informs HERDR-ADR-0020 (the herdr-core client) and HERDR-ADR-0021 (strings centralized, kinds as objects). Plain data: it imports types only, so the kernel and the errors can import it.
import type { Count, Duration, NonEmptyText, Text } from './kernel.ts';

export const HC_SOCKET_ENV = 'HC_SOCKET' as NonEmptyText;
export const HC_RUNTIME_ENV = 'XDG_RUNTIME_DIR' as NonEmptyText;
export const HC_SESSION_ENV = 'HC_SESSION' as NonEmptyText;
export const HC_DEFAULT_SESSION = 'default' as NonEmptyText;
export const HC_SOCKET_FOLDER = 'herdr-core' as NonEmptyText;
export const HC_RUN_ROOT = '/run/user' as NonEmptyText;
export const HC_SOCKET_SUFFIX = '.sock' as NonEmptyText;
export const HC_GENERATION = 1 as Count;
export const HC_HELLO_METHOD = 'hello' as NonEmptyText;
export const HC_SUBSCRIBE_METHOD = 'events.subscribe' as NonEmptyText;
export const HC_LIST_METHOD = 'terminal.list' as NonEmptyText;
export const HC_GET_METHOD = 'terminal.get' as NonEmptyText;
export const HC_READ_METHOD = 'terminal.read' as NonEmptyText;
export const HC_HELLO_TIMEOUT = 5000 as Duration;
export const HC_BACKOFF_BASE = 500 as Duration;
export const HC_BACKOFF_CAP = 15_000 as Duration;
export const HC_BACKOFF_MAX_DOUBLINGS = 20;
export const HC_HEARTBEAT_EVERY = 15_000 as Duration;
export const HC_HEARTBEAT_MISSES = 2 as Count;
export const HC_CALL_TIMEOUT = 10_000 as Duration;
export const HC_LINE_CAP = 33_554_432 as Count;
export const HC_JSONRPC_VERSION = '2.0';
export const HC_LINE_SEPARATOR = '\n';
export const EMPTY_TEXT = '' as Text;
export const UTF8 = 'utf8';
export const FIRST_CALL_ID = 1;

// The messages the core client puts in an Unknown or an error.
export const CoreText = {
  NoConnection: 'no connection' as Text,
  Closed: 'link closed' as Text,
  Dropped: 'connection dropped' as Text,
  Down: 'the core is down; reconnecting' as Text,
  Connecting: 'connecting' as Text,
  HelloUnreadable: 'hello reply' as Text,
  OddResult: 'a result that is not an object' as Text,
  Generation: (generation: Count): Text => `generation ${generation}` as Text,
  Fault: (reason: Text, message: Text): Text => `${reason}: ${message}` as Text,
  Invariant: (detail: string): string => `a load-time constant was refused: ${detail}`,
} as const;

export const JsType = { Object: 'object', Number: 'number', String: 'string' } as const;

export const ResultKind = { Ok: 'ok', Err: 'err' } as const;

export type ResultKind = (typeof ResultKind)[keyof typeof ResultKind];

export const ParseFailureKind = {
  NotAString: 'not-a-string',
  NotANumber: 'not-a-number',
  Empty: 'empty',
  NotAnInteger: 'not-an-integer',
  NotARow: 'not-a-row',
  OutOfRange: 'out-of-range',
} as const;

export type ParseFailureKind = (typeof ParseFailureKind)[keyof typeof ParseFailureKind];

export const CoreErrorName = { Invariant: 'CoreInvariantError' } as const;

export const UnknownWhy = {
  Timeout: 'timeout',
  Unreadable: 'unreadable',
  Unreachable: 'unreachable',
  NotFound: 'not-found',
  Failed: 'failed',
} as const;

export type UnknownWhy = (typeof UnknownWhy)[keyof typeof UnknownWhy];

// What a call settled as: an answer from the core, or Unknown.
export const OutcomeKind = { Answer: 'answer', Unknown: 'unknown' } as const;

export type OutcomeKind = (typeof OutcomeKind)[keyof typeof OutcomeKind];

// The kinds of a parsed message and of a feed item.
export const HcKind = {
  Reply: 'reply',
  Odd: 'odd',
  Fault: 'fault',
  Event: 'event',
  Heartbeat: 'heartbeat',
  Missed: 'missed',
  Snapshot: 'snapshot',
} as const;

export type HcKind = (typeof HcKind)[keyof typeof HcKind];

// The notification methods the core pushes on a subscription.
export const HcNotificationMethod = { Event: 'event', Heartbeat: 'heartbeat', Missed: 'missed' } as const;

export type HcNotificationMethod = (typeof HcNotificationMethod)[keyof typeof HcNotificationMethod];

// The JSON fields of the core's wire.
export const HcField = {
  JsonRpc: 'jsonrpc',
  Id: 'id',
  Method: 'method',
  Params: 'params',
  Result: 'result',
  Error: 'error',
  Seq: 'seq',
  Terminals: 'terminals',
  Terminal: 'terminal',
  Generation: 'generation',
  Version: 'version',
  Methods: 'methods',
  Code: 'code',
  Message: 'message',
  Data: 'data',
  Kind: 'kind',
  Type: 'type',
} as const;

export const LinkState = { Idle: 'idle', Connecting: 'connecting', Ready: 'ready', Backoff: 'backoff', Closed: 'closed' } as const;

export type LinkState = (typeof LinkState)[keyof typeof LinkState];

export const EventsPhase = { Waiting: 'waiting', Subscribed: 'subscribed' } as const;

export type EventsPhase = (typeof EventsPhase)[keyof typeof EventsPhase];

export const Life = { Open: 'open', Closed: 'closed' } as const;

export type Life = (typeof Life)[keyof typeof Life];

export const RetryPhase = { Idle: 'idle', Waiting: 'waiting' } as const;

export type RetryPhase = (typeof RetryPhase)[keyof typeof RetryPhase];

// Whether a retry timer keeps the process alive.
export const TimerHold = { HoldsProcess: 'holds-process', LetsProcessEnd: 'lets-process-end' } as const;

export type TimerHold = (typeof TimerHold)[keyof typeof TimerHold];

export const SocketEvent = { Data: 'data', Error: 'error', Close: 'close', Connect: 'connect' } as const;
