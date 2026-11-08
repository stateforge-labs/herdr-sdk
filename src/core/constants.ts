// Role: the names, environment variables, timings, messages, wire fields, message kinds and states of the herdr-core client, as objects.
// Informs HERDR-ADR-0020 (the herdr-core client); ported from the desktop work in herdr-plugins.
import { must } from './kernel.ts';
import { parseCount, type Count } from './kernel.ts';
import { parseNonEmptyText, parseText, type NonEmptyText, type Text } from './kernel.ts';
import { duration, type Duration } from './kernel.ts';

export const HC_SOCKET_ENV: NonEmptyText = must(parseNonEmptyText('HC_SOCKET'));
export const HC_RUNTIME_ENV: NonEmptyText = must(parseNonEmptyText('XDG_RUNTIME_DIR'));
export const HC_SESSION_ENV: NonEmptyText = must(parseNonEmptyText('HC_SESSION'));
export const HC_DEFAULT_SESSION: NonEmptyText = must(parseNonEmptyText('default'));
export const HC_SOCKET_FOLDER: NonEmptyText = must(parseNonEmptyText('herdr-core'));
export const HC_RUN_ROOT: NonEmptyText = must(parseNonEmptyText('/run/user'));
export const HC_SOCKET_SUFFIX: NonEmptyText = must(parseNonEmptyText('.sock'));
export const HC_GENERATION: Count = must(parseCount(1));
export const HC_HELLO_METHOD: NonEmptyText = must(parseNonEmptyText('hello'));
export const HC_SUBSCRIBE_METHOD: NonEmptyText = must(parseNonEmptyText('events.subscribe'));
export const HC_HELLO_TIMEOUT: Duration = duration(5000);
export const HC_BACKOFF_BASE: Duration = duration(500);
export const HC_BACKOFF_CAP: Duration = duration(15_000);
export const HC_HEARTBEAT_EVERY: Duration = duration(15_000);
export const HC_HEARTBEAT_MISSES: Count = must(parseCount(2));
export const HC_CALL_TIMEOUT: Duration = duration(10_000);
export const HC_NO_CONNECTION: Text = must(parseText('no connection'));
export const HC_CLOSED: Text = must(parseText('link closed'));
export const HC_DROPPED: Text = must(parseText('connection dropped'));
export const HC_DOWN: Text = must(parseText('the core is down; reconnecting'));
export const HC_CONNECTING: Text = must(parseText('connecting'));
export const HC_HELLO_UNREADABLE: Text = must(parseText('hello reply'));
export const HC_ODD_RESULT: Text = must(parseText('a result that is not an object'));
export const HC_LINE_CAP: Count = must(parseCount(33_554_432));
export const HC_LIST_METHOD: NonEmptyText = must(parseNonEmptyText('terminal.list'));
export const HC_READ_METHOD: NonEmptyText = must(parseNonEmptyText('terminal.read'));
export const HC_GET_METHOD: NonEmptyText = must(parseNonEmptyText('terminal.get'));
export const HC_JSONRPC_VERSION = '2.0';

// The kinds of a parsed message and of a feed item (HERDR-ADR-0020).
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

export const UTF8 = 'utf8';
export const HC_LINE_SEPARATOR = '\n';
