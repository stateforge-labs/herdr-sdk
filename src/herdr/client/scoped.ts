// Role: the capability-scoped clients (read-only, prompt, admin): allowed methods, the namespace tree, invoke and the stream members.
// Informs HERDR-ADR-0005, HERDR-ADR-0017, plan 3.4, plan 3.3, HERDR-ADR-0007, plan 3.6, plan 10.1, HERDR-ADR-0015; merged by HERDR-ADR-0021 from allowed-methods.ts, namespace-tree.ts, invoke.ts, lazy-streams.ts, compose.ts, connect-admin.ts, connect-prompt.ts, connect-read-only.ts.
import { LONG_POLL } from '../generated/index.ts';
import type { Method } from '../generated/index.ts';
import type { AllowedMethods, BuildNamespaceTree, CallOptions, Invoke, NamespaceTree, CoreClient, StreamMembers, ClientTransport, Caller, AdminClient, ConnectAdmin, ConnectPrompt, PromptClient, ConnectReadOnly, ReadOnlyClient, ReadOnlyContentClient, ReadOnlyOptions, SessionsReaderClient } from './types.ts';
import { METHOD_SEPARATOR, TypeofKind, ErrorText, EntryKey, TreeKey, Presets } from '../../constants.ts';
import type { Preset } from '../../constants.ts';
import { MethodEventsSubscribe, MethodSessionSnapshot } from '../generated/names/method.ts';
import { HerdrTransportError } from '../errors.ts';
import type { ParamsOf, ResultOf } from '../wire/types.ts';
import { assertLongPollBounds as defaultAssertBounds, requestTimeoutMs as defaultRequestTimeoutMs } from './long-poll.ts';
import type { AssertLongPollBounds, RequestTimeoutMs } from './long-poll.ts';
import type { Hold, HeldConnection, HoldOptions, CreateHold } from './held.ts';
import type { Subscribe, CreateSubscribe } from './subscribe.ts';
import type { Watch, WatchChange, WatchFn, WatchOptions, CreateWatch } from './watch.ts';
import { ADMIN_METHODS } from '../generated/entries/admin.ts';
import { connectCore } from './connect.ts';
import { PROMPT_METHODS } from '../generated/entries/prompt.ts';
import { READ_ONLY_CONTENT_METHODS } from '../generated/entries/read-only-content.ts';
import { READ_ONLY_METHODS } from '../generated/entries/read-only.ts';
import { SESSIONS_READER_METHODS } from '../generated/presets/sessions-reader.ts';

export const allowedMethods: AllowedMethods = function allowedMethods(base, options = {}) {
  return options.methods === undefined ? new Set<Method>(base) : narrow(base, options.methods);
};

// A method outside the base list is dropped, not added: `methods` can only narrow the entry.
function narrow(base: readonly Method[], methods: readonly Method[]): ReadonlySet<Method> {
  const inBase = new Set<Method>(base);
  return new Set<Method>(methods.filter((method) => inBase.has(method)));
}

type MutableTree = { [segment: string]: MutableTree | Leaf };
type Leaf = (params?: unknown, options?: CallOptions) => Promise<unknown>;

export const buildNamespaceTree: BuildNamespaceTree = function buildNamespaceTree(allowed, invoke) {
  const root: MutableTree = {};
  for (const method of allowed) {
    // events.subscribe is never a leaf: the composer adds the real Subscribe in its place.
    if (method !== MethodEventsSubscribe) {
      addLeaf(root, method, invoke);
    }
  }
  return freezeTree(root);
};

// `agent.view.set` becomes root.agent.view.set; the names come from the allow-list itself, so no generated table is needed.
function addLeaf(root: MutableTree, method: Method, invoke: Invoke): void {
  const path = method.split(METHOD_SEPARATOR);
  const leafName = path.pop();
  if (leafName === undefined) {
    return;
  }
  const branch = ensureBranch(root, path);
  branch[leafName] = leafFor(method, invoke);
}

// No generated method name is also a branch of another (test/herdr/client/scoped/namespace-tree.test.ts), so a leaf is never replaced by a branch.
function ensureBranch(root: MutableTree, segments: readonly string[]): MutableTree {
  let node = root;
  for (const segment of segments) {
    const existing = node[segment];
    if (existing === undefined || isLeaf(existing)) {
      const created: MutableTree = {};
      node[segment] = created;
      node = created;
    } else {
      node = existing;
    }
  }
  return node;
}

function isLeaf(node: MutableTree | Leaf): node is Leaf {
  return typeof node === TypeofKind.Function;
}

// The default params are an empty object, so `herdr.ping()` sends `{}` as every generated namespace does.
function leafFor(method: Method, invoke: Invoke): Leaf {
  return (params = {}, options) => invoke(method, params, options);
}

function freezeTree(node: MutableTree): NamespaceTree {
  for (const value of Object.values(node)) {
    if (!isLeaf(value)) {
      freezeTree(value);
    }
  }
  return Object.freeze(node);
}

/** The P4a helpers a long-poll call needs; tests pass stubs. */
export interface InvokeDeps {
  readonly requestTimeoutMs: RequestTimeoutMs;
  readonly assertLongPollBounds: AssertLongPollBounds;
}

const DEFAULT_DEPS: InvokeDeps = {
  requestTimeoutMs: defaultRequestTimeoutMs,
  assertLongPollBounds: defaultAssertBounds,
};

export function createInvoke(core: CoreClient, allowed: ReadonlySet<Method>, deps: InvokeDeps = DEFAULT_DEPS): Invoke {
  return async function invoke(method, params, options = {}) {
    assertAllowed(method, allowed);
    // The generated tree and the generic call() both pass params typed by the method name; the server checks the shape.
    const wire = params as ParamsOf<Method>;
    if (!isLongPoll(method)) {
      return core.call(method, wire, options);
    }
    deps.assertLongPollBounds(method, params);
    const timeoutMs = deps.requestTimeoutMs(method, params, core.transport.timeoutMs);
    return core.call(method, wire, withTimeout(options, timeoutMs));
  };
}

/** Throws before anything is sent when the method is not in the entry's allow-list. */
export function assertAllowed(method: Method, allowed: ReadonlySet<Method>): void {
  if (!allowed.has(method)) {
    throw new HerdrTransportError(ErrorText.NotAllowed(method));
  }
}

function isLongPoll(method: Method): boolean {
  return Object.hasOwn(LONG_POLL, method);
}

// The computed long-poll timeout is a default: a timeoutMs the caller set on this call wins (connect-core.callRpcOptions says the same).
function withTimeout(options: CallOptions, timeoutMs: number | undefined): CallOptions {
  return timeoutMs === undefined || options.timeoutMs !== undefined ? options : { ...options, timeoutMs };
}

// One load per client: the first member used starts the import, every later one awaits the same promise.
export function lazyStreams(core: CoreClient): StreamMembers {
  let loaded: Promise<StreamMembers> | undefined;
  const load = (): Promise<StreamMembers> => {
    loaded ??= import('./streams.ts').then((module) => module.createStreamMembers(core));
    return loaded;
  };
  const subscribe: Subscribe = async (specs, options) => {
    const members = await load();
    return members.subscribe(specs, options);
  };
  const hold: Hold = async (options?: HoldOptions): Promise<HeldConnection> => {
    const members = await load();
    return members.hold(options);
  };
  return { subscribe, watch: lazyWatch(load), hold };
}

// watch() is synchronous, so it returns at once; the real watch is created when iteration starts, as the real one does. close() before that ends the iteration without creating it.
function lazyWatch(load: () => Promise<StreamMembers>): WatchFn {
  return function watch<S>(options: WatchOptions<S>): Watch<S> {
    let stopped = false;
    let inner: Watch<S> | undefined;
    async function* changes(): AsyncGenerator<WatchChange<S>> {
      const members = await load();
      if (stopped) {
        return;
      }
      inner = members.watch(options);
      yield* inner;
    }
    return {
      close(): void {
        stopped = true;
        inner?.close();
      },
      [Symbol.asyncIterator]: changes,
    };
  };
}

/** Which members beyond the namespace tree an entry has. */
export interface Members {
  readonly call: boolean;
  readonly streams: boolean;
  readonly hold: boolean;
}

const FULL_MEMBERS: Members = { call: true, streams: true, hold: true };
const STREAM_MEMBERS: Members = { call: false, streams: true, hold: false };
const NO_MEMBERS: Members = { call: false, streams: false, hold: false };

/** connect() and connectAdmin() have everything; the read-only entries stream; prompt has no streams and no call(). */
export const ENTRY_MEMBERS = {
  [EntryKey.client]: FULL_MEMBERS,
  [EntryKey.admin]: FULL_MEMBERS,
  [EntryKey.prompt]: NO_MEMBERS,
  [EntryKey.readOnly]: STREAM_MEMBERS,
  [EntryKey.readOnlyContent]: STREAM_MEMBERS,
} as const;

/** The preset form of connectReadOnly: a fixed list with no streams and no call(). */
export const PRESET_MEMBERS: Members = NO_MEMBERS;

/**
 * Builds a public client of type T from the core and the allow-list. The tree is built from exactly `allowed`;
 * T is the generated type of the same entry. The runtime object is assembled from the tree and the members, so its static
 * type is asserted to T by the final cast; the contract type tests (test/types) check the members of each T.
 * `streams` is the lazy loader of the stream members (lazy-streams.ts); tests pass their own.
 */
export function composeClient<T>(
  core: CoreClient,
  allowed: ReadonlySet<Method>,
  members: Members,
  streams: StreamMembers = lazyStreams(core),
): T {
  const invoke = createInvoke(core, allowed);
  const tree = buildNamespaceTree(allowed, invoke);
  const client: Record<string, unknown> = {
    ...tree,
    capabilities: core.capabilities,
    serverInfo: core.serverInfo,
    close: (): void => {
      core.close();
    },
  };
  if (members.call) {
    client.call = callWith(invoke);
  }
  if (members.streams) {
    // The refusals are synchronous, before anything is sent or loaded: watch() is built on events.subscribe and session.snapshot.
    if (allowed.has(MethodEventsSubscribe)) {
      client.events = eventsWith(tree, streams.subscribe);
    }
    requireAllowed(MethodEventsSubscribe, allowed);
    requireAllowed(MethodSessionSnapshot, allowed);
    client.watch = streams.watch;
  }
  if (members.hold) {
    client.hold = streams.hold;
  }
  return Object.freeze(client) as T;
}

function requireAllowed(method: Method, allowed: ReadonlySet<Method>): void {
  if (!allowed.has(method)) {
    throw new HerdrTransportError(ErrorText.NotAllowed(method));
  }
}

/**
 * composeClient, but closes the core when composition refuses (a watch on a method list without its methods), so the
 * connection the core opened is not left live. Every connect function composes through this.
 */
export function composeOrClose<T>(
  core: CoreClient,
  allowed: ReadonlySet<Method>,
  members: Members,
  streams: StreamMembers = lazyStreams(core),
): T {
  try {
    return composeClient<T>(core, allowed, members, streams);
  } catch (error) {
    core.close();
    throw error;
  }
}

// call() is the generic escape hatch: the same allow-list and long-poll path as every leaf, with the result typed by the method.
function callWith(invoke: Invoke): Caller<Method>['call'] {
  return function call<K extends Method>(method: K, params: ParamsOf<K>, options?: CallOptions): Promise<ResultOf<K>> {
    return invoke(method, params, options) as Promise<ResultOf<K>>;
  };
}

// The generated events branch (every event leaf except subscribe) plus the composed subscribe.
function eventsWith(tree: NamespaceTree, subscribe: StreamMembers['subscribe']): NamespaceTree {
  const branch = tree[TreeKey.Events] as NamespaceTree | undefined;
  return Object.freeze({ ...branch, [TreeKey.Subscribe]: subscribe }) as NamespaceTree;
}

export const connectAdmin: ConnectAdmin = async function connectAdmin(options = {}) {
  const core = await connectCore(options);
  return composeOrClose<AdminClient>(
    core,
    allowedMethods(ADMIN_METHODS),
    ENTRY_MEMBERS[EntryKey.admin],
    lazyStreams(core),
  );
};

export const connectPrompt: ConnectPrompt = async function connectPrompt(options = {}) {
  const core = await connectCore(options);
  return composeOrClose<PromptClient>(core, allowedMethods(PROMPT_METHODS), ENTRY_MEMBERS[EntryKey.prompt]);
};

// The preset lists this entry can name. Only the list of each preset is imported, not the table of every entry.
const PRESET_LISTS: Readonly<Record<Preset, readonly Method[]>> = {
  [Presets.SessionsReader]: SESSIONS_READER_METHODS,
};

// The three overloads of ConnectReadOnly share this one implementation; the options a caller passes pick the overload.
type ReadOnlyFormOptions = ReadOnlyOptions & { readonly preset?: Preset | undefined };
type ReadOnlyAnyClient = ReadOnlyClient | ReadOnlyContentClient | SessionsReaderClient;

async function connectReadOnlyForm(options: ReadOnlyFormOptions = {}): Promise<ReadOnlyAnyClient> {
  const core = await connectCore(options);
  if (options.preset !== undefined) {
    return composeOrClose<SessionsReaderClient>(
      core,
      allowedMethods(PRESET_LISTS[options.preset]),
      PRESET_MEMBERS,
      lazyStreams(core),
    );
  }
  const entry = options.content === true ? EntryKey.readOnlyContent : EntryKey.readOnly;
  const base = entry === EntryKey.readOnlyContent ? READ_ONLY_CONTENT_METHODS : READ_ONLY_METHODS;
  const allowed = allowedMethods(base, options.methods === undefined ? {} : { methods: options.methods });
  return composeOrClose<ReadOnlyClient | ReadOnlyContentClient>(core, allowed, ENTRY_MEMBERS[entry], lazyStreams(core));
}

// One implementation for the three overloads: the union return is narrowed by the overload the caller's options match.
export const connectReadOnly: ConnectReadOnly = connectReadOnlyForm as ConnectReadOnly;
