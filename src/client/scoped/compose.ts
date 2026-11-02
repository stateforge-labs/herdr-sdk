// Role: composes one scoped client: its namespace tree plus only the members its entry has (call, streams, hold) on top of the core's own members.
// Informs HERDR-ADR-0005 (members per class set), plan 3.3 (one tree builder, close is local) and plan 3.4 (entries); the composed object is typed as the generated client type by the cast at the end of composeClient.
import { EntryKey, TreeKey } from '../../constants.ts';
import { Method } from '../../generated/index.ts';
import type { ParamsOf, ResultOf } from '../../wire/types.ts';
import type { CallOptions, Caller, CoreClient, Invoke, NamespaceTree } from '../types.ts';
import { buildNamespaceTree } from './namespace-tree.ts';
import { createInvoke } from './invoke.ts';
import { holdFor, subscribeFor, watchFor } from './streams.ts';

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
 * Builds a public client of type T from the core and the allow-list. The tree is built from METHODS for exactly `allowed`;
 * T is the generated type of the same entry. The runtime object is assembled from the tree and the members, so its static
 * type is asserted to T by the final cast; the contract type tests (test/types) check the members of each T.
 */
export function composeClient<T>(core: CoreClient, allowed: ReadonlySet<Method>, members: Members): T {
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
    const subscribe = subscribeFor(core.transport);
    // watchFor refuses unless events.subscribe is allowed, so the composed subscribe is attached only for an allowed method.
    if (allowed.has(Method.EventsSubscribe)) {
      client.events = eventsWith(tree, subscribe);
    }
    client.watch = watchFor(subscribe, allowed);
  }
  if (members.hold) {
    client.hold = holdFor(core);
  }
  return Object.freeze(client) as T;
}

/**
 * composeClient, but closes the core when composition refuses (a watch on a method list without its methods), so the
 * connection the core opened is not left live. Every connect function composes through this.
 */
export function composeOrClose<T>(core: CoreClient, allowed: ReadonlySet<Method>, members: Members): T {
  try {
    return composeClient<T>(core, allowed, members);
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
function eventsWith(tree: NamespaceTree, subscribe: ReturnType<typeof subscribeFor>): NamespaceTree {
  const branch = tree[TreeKey.Events] as NamespaceTree | undefined;
  return Object.freeze({ ...branch, [TreeKey.Subscribe]: subscribe }) as NamespaceTree;
}
