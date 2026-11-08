// Role: builds the nested method tree once, eagerly, from exactly the allowed methods (no Proxy, no getters, no generated METHODS table).
// Informs HERDR-ADR-0005 (capability-scoped clients), plan 3.3 (one tree builder, shared with held connections), plan 3.4 and 10.1 step 2; contract in client/types.ts (BuildNamespaceTree).
import { METHOD_SEPARATOR, TypeofKind } from '../../../constants.ts';
import { MethodEventsSubscribe } from '../../generated/names/method.ts';
import type { Method } from '../../generated/index.ts';
import type { BuildNamespaceTree, CallOptions, Invoke, NamespaceTree } from '../types.ts';

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
