// Role: composes one scoped client: its namespace tree plus only the members its entry has (call, streams, hold) on top of the core's own members.
// Informs HERDR-ADR-0005 (members per class set), plan 3.3 (one tree builder, close is local), plan 3.4 (entries) and plan 10.1 step 3 (streams load lazily); the composed object is typed as the generated client type by the cast at the end of composeClient.
import { ErrorText, EntryKey, TreeKey } from '../../../constants.ts';
import { MethodEventsSubscribe, MethodSessionSnapshot } from '../../generated/names/method.ts';
import type { Method } from '../../generated/index.ts';
import { HerdrTransportError } from '../../wire/errors.ts';
import type { ParamsOf, ResultOf } from '../../wire/types.ts';
import type { CallOptions, Caller, CoreClient, Invoke, NamespaceTree, StreamMembers } from '../types.ts';
import { buildNamespaceTree } from './namespace-tree.ts';
import { createInvoke } from './invoke.ts';
import { lazyStreams } from './lazy-streams.ts';

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
