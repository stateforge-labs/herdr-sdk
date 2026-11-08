// Role: every string and number of the fake herdr-core: its file names, recorded-frame names, fault kinds and codes, messages and demo terminals.
// Informs HERDR-ADR-0020 (the fake core) and HERDR-ADR-0021 (strings centralized). Shipped only in ./core/test-kit.

export const FakeName = { DirPrefix: 'herdr-core-fake-', Socket: 'default.sock' } as const;

// The JSON-RPC fault kinds and codes the fake answers with.
export const FakeFaultKind = { MethodNotFound: 'method_not_found', NotFound: 'not_found' } as const;

export const FakeRpcCode = { MethodNotFound: -32601, NotFound: -32000 } as const;

// The names of the recorded frames in frames.ts.
export const FrameName = {
  Hello: 'hello',
  Subscribed: 'subscribed',
  Created: 'event:created',
  eventOf: (type: string): string => `event:${type}`,
} as const;

// Fields of a terminal and of the fake's replies that the core client does not read itself.
export const FakeField = {
  Address: 'address',
  HiddenFinished: 'hidden_finished',
  Channel: 'channel',
} as const;

export const FakeText = {
  NoFrame: (name: string): string => `no scripted frame ${name}`,
  NoMethod: (method: string): string => `no method ${method}`,
  NoTerminal: (address: unknown): string => `no terminal "${String(address)}"`,
  Screen: (terminal: unknown): string => `screen of ${String(terminal)}`,
} as const;

export const FakeScreen = { How: 'screen' } as const;

// Replies split in two halves: the first SPLIT_AT characters, then the rest after SPLIT_DELAY ms.
export const SPLIT_AT = 7;
export const SPLIT_DELAY = 15;

// The two demo terminals every fake starts with.
export const DemoTerminal = {
  First: 't1',
  Second: 't2',
  Working: 'working',
  Idle: 'idle',
  Live: 'live',
  App: 'claude-code',
  Argv: ['claude'],
  Cwd: '~/work/probe',
  Name: 'claude',
  Pid: 4242,
  Labels: { 'herdr.tab': 'tb1', 'herdr.space': 'sp1', where: 'S / 1' },
} as const;
