// Role: CONTRACT of the client layer: connect options, the core client P2a builds, the public client types per entry
// (built from the generated namespace types), the scoped-entry options and presets, and the factories the lanes implement.
// Informs HERDR-ADR-0017 (locked seam; read-only for every lane), HERDR-ADR-0004 (Promise core), HERDR-ADR-0005
// (capability-scoped clients), plan 3.1 (capabilities), 3.3 (connect options) and 3.4 (scoped clients).
import type { Preset, ProtocolPolicy } from '../../constants.ts';
import type {
  AdminNamespaces,
  CallOptions,
  ClientNamespaces,
  ENTRY_METHODS,
  Method,
  PromptNamespaces,
  ReadOnlyContentNamespaces,
  ReadOnlyNamespaces,
  SessionsReaderNamespaces,
} from '../generated/index.ts';
import type { ServerCapabilities } from '../generated/results.ts';
import type { EnvMap } from '../wire/socket-path.ts';
import type { OnCall, ParamsOf, ResultOf, UnknownFrame } from '../wire/types.ts';
import type { Hold } from './held.ts';
import type { Subscribe } from './subscribe.ts';
import type { WatchFn } from './watch.ts';

export type { CallOptions } from '../generated/index.ts';

/** Options of every connect function. */
export interface ConnectOptions {
  /** Explicit path; else HERDR_SOCKET; else ~/.config/herdr/herdr.sock. */
  readonly socketPath?: string | undefined;
  /** Per-request timeout; default Timeout.DefaultMs (10 s). Long-poll calls add their own timeout_ms (plan 3.6). */
  readonly timeoutMs?: number | undefined;
  /** Exact (default) or Minimum. A mismatch rejects with ProtocolMismatchError. */
  readonly protocolPolicy?: ProtocolPolicy | undefined;
  readonly onCall?: OnCall | undefined;
  /**
   * Called once per UnknownFrame on every subscription of this client, including the ones watch() and watchPaneSet()
   * open (HERDR-ADR-0016 P3). When a per-call onUnknown is also set, both fire: this one first, then the per-call one.
   * subscribe is the only place that calls them; watch() forwards its own onUnknown to subscribe and never calls either.
   */
  readonly onUnknown?: ((frame: UnknownFrame) => void) | undefined;
  /** Environment used to find the socket; tests pass their own, so nothing reads process.env. */
  readonly env?: EnvMap | undefined;
}

/** What the server advertised in its pong. A missing key is not advertised. */
export type ClientCapabilities = Readonly<Partial<ServerCapabilities>>;

/** Server facts fixed at connect time. */
export interface ServerInfo {
  readonly protocol: number;
  readonly version: string;
}

/**
 * Members every client has. close() is local: later calls reject with HerdrTransportError without contacting herdr,
 * and it aborts ClientTransport.closed, which ends every live subscription, watch loop and held connection of this
 * client (each one closes as if its own close() ran). Idempotent.
 */
export interface ClientBase {
  readonly capabilities: ClientCapabilities;
  /** Not `server`: that name is herdr's `server.*` namespace. */
  readonly serverInfo: ServerInfo;
  close(): void;
}

/**
 * The connection settings connectCore resolved once (socket path from options/env, timeout default applied). P2b
 * passes them to SubscribeDeps and HoldDeps; nobody resolves them a second time. Not on public clients.
 */
export interface ClientTransport {
  readonly socketPath: string;
  readonly timeoutMs: number;
  readonly onCall?: OnCall | undefined;
  readonly onUnknown?: ((frame: UnknownFrame) => void) | undefined;
  /** Aborted by close(). */
  readonly closed: AbortSignal;
}

/** The generic escape hatch, limited to the methods `M` of the entry. Not on read-only or prompt clients. */
export interface Caller<M extends Method> {
  call<K extends M>(method: K, params: ParamsOf<K>, options?: CallOptions): Promise<ResultOf<K>>;
}

/** Streaming members (on clients whose class set includes L). */
export interface Streaming {
  readonly watch: WatchFn;
}

/** Held connections (on clients whose class set includes C). */
export interface Holding {
  readonly hold: Hold;
}

/** Replaces the generated `events.subscribe` placeholder with the real Subscribe (array of specs -> EventSubscription). */
export type WithSubscribe<N extends { events: object }> = Omit<N, 'events'> & {
  readonly events: Omit<N['events'], 'subscribe'> & { readonly subscribe: Subscribe };
};

/** Method names of one entry, from the generated ENTRY_METHODS table. */
export type EntryName = keyof typeof ENTRY_METHODS;
export type EntryMethod<E extends EntryName> = (typeof ENTRY_METHODS)[E][number];

/** P2a's client: ping, protocol policy, capabilities, gate, call(), and the resolved transport. Composed into every public client by P2b. */
export type CoreClient = ClientBase & Caller<Method> & { readonly transport: ClientTransport };

/** `connect()` (`.`): R-meta, R-content, W, I, H, L, C; no D, S, X. */
export type Client = WithSubscribe<ClientNamespaces> & ClientBase & Caller<EntryMethod<'client'>> & Streaming & Holding;

/** `connectAdmin()` (`/admin`): all methods. */
export type AdminClient = WithSubscribe<AdminNamespaces> & ClientBase & Caller<Method> & Streaming & Holding;

/** `connectReadOnly()`: R-meta + L. No call(), no writes. */
export type ReadOnlyClient = WithSubscribe<ReadOnlyNamespaces> & ClientBase & Streaming;

/** `connectReadOnly({ content: true })`: adds R-content. */
export type ReadOnlyContentClient = WithSubscribe<ReadOnlyContentNamespaces> & ClientBase & Streaming;

/** `connectPrompt()`: R-meta + agent.prompt. */
export type PromptClient = PromptNamespaces & ClientBase;

/** `connectReadOnly({ preset: Presets.SessionsReader })`: exactly PRESET_METHODS.SessionsReader. */
export type SessionsReaderClient = SessionsReaderNamespaces & ClientBase;

/** Options of connectReadOnly without a preset. `methods` narrows at runtime only; the type stays ReadOnlyClient. */
export interface ReadOnlyOptions extends ConnectOptions {
  readonly content?: boolean | undefined;
  readonly methods?: readonly EntryMethod<'readOnlyContent'>[] | undefined;
}

export interface PresetOptions extends ConnectOptions {
  readonly preset: Preset;
}

/** P2a: socket, ping, protocol policy, capabilities. Implemented by client/connect-core.ts. */
export type ConnectCore = (options?: ConnectOptions) => Promise<CoreClient>;

/** P2b. Implemented by client/connect.ts. */
export type Connect = (options?: ConnectOptions) => Promise<Client>;

/** P2b. Implemented by client/scoped/connect-admin.ts. */
export type ConnectAdmin = (options?: ConnectOptions) => Promise<AdminClient>;

/** P2b. Implemented by client/scoped/connect-prompt.ts. */
export type ConnectPrompt = (options?: ConnectOptions) => Promise<PromptClient>;

/** P2b. Implemented by client/scoped/connect-read-only.ts. Overloads: preset, content, default. */
export interface ConnectReadOnly {
  (options: PresetOptions): Promise<SessionsReaderClient>;
  (options: ReadOnlyOptions & { readonly content: true }): Promise<ReadOnlyContentClient>;
  (options?: ReadOnlyOptions): Promise<ReadOnlyClient>;
}

/** Sends one allowed method; the tree calls it for every leaf. Applies the gate, long-poll timeout and allow-list. */
export type Invoke = (method: Method, params: unknown, options?: CallOptions) => Promise<unknown>;

/** A namespace tree before it is typed as one of the generated namespace interfaces (plain nested objects). */
export type NamespaceTree = { readonly [segment: string]: NamespaceTree | ((params?: unknown, options?: CallOptions) => Promise<unknown>) };

/**
 * Builds the nested tree once, eagerly, from exactly `allowed` (no Proxy, no getters; plan 3.3).
 * `events.subscribe` is NOT a leaf of the tree; the composer adds Subscribe. Implemented by client/scoped/namespace-tree.ts (P2b).
 * Also the builder of held connections: hold() calls it with the held list and an Invoke over the dedicated
 * connection. There is no second tree builder.
 */
export type BuildNamespaceTree = (allowed: ReadonlySet<Method>, invoke: Invoke) => NamespaceTree;

/**
 * The allow-list of one scoped client: `base` is the entry's list (ENTRY_METHODS[entry], or a preset's list), narrowed by
 * `methods`. The caller passes the list it needs, so this module never imports the table of every entry (plan 10.1 step 2).
 * Implemented by client/scoped/allowed-methods.ts.
 */
export type AllowedMethods = (base: readonly Method[], options?: { readonly methods?: readonly Method[] }) => ReadonlySet<Method>;

/**
 * The stream members of one client: events.subscribe, the watch factory and hold. They are loaded on first use
 * (client/scoped/lazy-streams.ts), so a client that never streams does not carry their code.
 */
export interface StreamMembers {
  readonly subscribe: Subscribe;
  readonly watch: WatchFn;
  readonly hold: Hold;
}
