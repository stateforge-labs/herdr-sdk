// Role: builds the nested method tree once, eagerly, from the generated METHODS table for exactly the allowed methods (no Proxy, no getters).
// Informs HERDR-ADR-0005 (capability-scoped clients), plan 3.3 (one tree builder, shared with held connections) and plan 3.4; contract in client/types.ts (BuildNamespaceTree).
import { METHODS, Method } from '../../generated/index.ts';
import { METHOD_SEPARATOR, TypeofKind } from '../../constants.ts';
import type { BuildNamespaceTree, CallOptions, Invoke, NamespaceTree } from '../types.ts';

type MutableTree = { [segment: string]: MutableTree | Leaf };
type Leaf = (params?: unknown, options?: CallOptions) => Promise<unknown>;

export const buildNamespaceTree: BuildNamespaceTree = function buildNamespaceTree(allowed, invoke) {
  const root: MutableTree = {};
  for (const spec of METHODS) {
    if (allowed.has(spec.name) && spec.name !== Method.EventsSubscribe) {
      addLeaf(root, spec.name, invoke);
    }
  }
  return freezeTree(root);
};

// `agent.view.set` becomes root.agent.view.set; the composer adds events.subscribe, so it is never a leaf here.
function addLeaf(root: MutableTree, method: Method, invoke: Invoke): void {
  const path = method.split(METHOD_SEPARATOR);
  const leafName = path.pop();
  if (leafName === undefined) {
    return;
  }
  const branch = ensureBranch(root, path);
  branch[leafName] = leafFor(method, invoke);
}

// No generated method name is also a branch of another (test/scoped/namespace-tree.test.ts), so a leaf is never replaced by a branch.
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
