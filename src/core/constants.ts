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
// The JSON-RPC code of a fault for a row the core does not hold (the recorded frame error:-32000:not_found).
export const HC_RPC_NOT_FOUND = -32000;
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
  OddListing: 'terminal.list answered with an unexpected shape' as Text,
  OddScreen: 'terminal.read answered with no text' as Text,
  Generation: (generation: Count): Text => `generation ${generation}` as Text,
  Fault: (reason: Text, message: Text): Text => `${reason}: ${message}` as Text,
  Invariant: (detail: string): string => `a load-time constant was refused: ${detail}`,
} as const;

export const JsType = { Object: 'object', Number: 'number', String: 'string', Boolean: 'boolean' } as const;

export const ResultKind = { Ok: 'ok', Err: 'err' } as const;

export type ResultKind = (typeof ResultKind)[keyof typeof ResultKind];

export const ParseFailureKind = {
  NotAString: 'not-a-string',
  NotANumber: 'not-a-number',
  Empty: 'empty',
  NotAnInteger: 'not-an-integer',
  NotARow: 'not-a-row',
  NotABoolean: 'not-a-boolean',
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

// The labels herdr puts on a terminal: the tab and the workspace it belongs to.
export const HcLabel = { Tab: 'herdr.tab', Workspace: 'herdr.space' } as const;

// The fields of a terminal row. The status object reuses State for the agent's own state, as the wire does.
export const HcTerminalField = {
  Address: 'address',
  Labels: 'labels',
  State: 'state',
  Status: 'status',
  App: 'app',
  Foreground: 'foreground',
  Pid: 'pid',
  Cwd: 'cwd',
  Title: 'title',
} as const;

// The live state of a terminal row: a finished terminal keeps its row but is no longer live.
export const HcTerminalState = { Live: 'live', Finished: 'finished' } as const;

export type HcTerminalState = (typeof HcTerminalState)[keyof typeof HcTerminalState];

// The types of the core's terminal events. Created, restarted and removed add or drop a row; the others patch one.
export const HcEventType = {
  Created: 'created',
  Restarted: 'restarted',
  Removed: 'removed',
  Foreground: 'foreground',
  Labels: 'labels',
  Title: 'title',
  Status: 'status',
  Keep: 'keep',
  Size: 'size',
  Finished: 'finished',
  Lost: 'lost',
  Turn: 'turn',
  Doc: 'doc',
} as const;

export type HcEventType = (typeof HcEventType)[keyof typeof HcEventType];

// The fields an event's data carries and a row takes over when it is patched.
export const HcPatchField = {
  Foreground: 'foreground',
  Labels: 'labels',
  Title: 'title',
  Status: 'status',
  Reported: 'reported',
  Records: 'records',
  Keep: 'keep',
  Cols: 'cols',
  Rows: 'rows',
  ExitCode: 'exit_code',
  FinishedMs: 'finished_ms',
  Reason: 'reason',
  Signal: 'signal',
  State: 'state',
} as const;

export type HcPatchField = (typeof HcPatchField)[keyof typeof HcPatchField];

// How one delta of a roster step changes the table.
export const RosterChange = { Added: 'added', Changed: 'changed', Removed: 'removed' } as const;

export type RosterChange = (typeof RosterChange)[keyof typeof RosterChange];

// The fields of a terminal.read reply and of its parameters. `lines` is the history above the screen; 0 is the visible screen only.
export const HcReadField = {
  Terminal: 'terminal',
  Lines: 'lines',
  Text: 'text',
  Complete: 'complete',
  How: 'how',
  Why: 'why',
  HiddenFinished: 'hidden_finished',
} as const;

// How terminal.read got its text: the screen, the history, or both stitched (a full-screen app read by scrolling it).
export const HcReadHow = { Screen: 'screen', History: 'history', Stitched: 'stitched' } as const;

export type HcReadHow = (typeof HcReadHow)[keyof typeof HcReadHow];

// Why terminal.read gave only the screen: the agent is working or blocked, or the read failed.
export const HcReadWhy = { Working: 'working', Blocked: 'blocked', Error: 'error' } as const;

export type HcReadWhy = (typeof HcReadWhy)[keyof typeof HcReadWhy];
