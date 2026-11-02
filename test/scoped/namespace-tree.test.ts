// Role: the namespace tree: one eager, frozen tree per allowed set; every allowed method is a leaf that calls invoke; nothing else is.
// Informs HERDR-ADR-0005 (runtime allow-list), plan 3.3 (no Proxy, no getters) and plan 3.4; slice P2b-1.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { types } from 'node:util';
import { EntryKey, METHOD_SEPARATOR, TypeofKind } from '../../src/constants.ts';
import { METHODS, Method } from '../../src/generated/index.ts';
import { allowedMethods } from '../../src/client/scoped/allowed-methods.ts';
import { buildNamespaceTree } from '../../src/client/scoped/namespace-tree.ts';
import type { Invoke, NamespaceTree } from '../../src/client/types.ts';

type Call = { readonly method: string; readonly params: unknown };

// An Invoke that records what the leaves send and answers with the method name.
function recordingInvoke(): { invoke: Invoke; calls: Call[] } {
  const calls: Call[] = [];
  const invoke: Invoke = async (method, params) => {
    calls.push({ method, params });
    return method;
  };
  return { invoke, calls };
}

// Every leaf of the tree as its dotted method name, found by walking the objects.
function leafNames(node: NamespaceTree, prefix: string[] = []): string[] {
  return Object.entries(node).flatMap(([segment, value]) => {
    const path = [...prefix, segment];
    return typeof value === TypeofKind.Function ? [path.join(METHOD_SEPARATOR)] : leafNames(value, path);
  });
}

function leafAt(tree: NamespaceTree, method: string): unknown {
  return method.split(METHOD_SEPARATOR).reduce<unknown>((node, segment) => {
    return typeof node === TypeofKind.Object && node !== null ? Reflect.get(node, segment) : undefined;
  }, tree);
}

describe('buildNamespaceTree', () => {
  test('tree.pane.list and tree.agent.view.set are functions for the client entry', () => {
    const tree = buildNamespaceTree(allowedMethods(EntryKey.client), recordingInvoke().invoke);
    assert.equal(typeof leafAt(tree, Method.PaneList), 'function');
    assert.equal(typeof leafAt(tree, Method.AgentViewSet), 'function');
  });

  test('a leaf calls invoke with the dotted method name and the given params and options', async () => {
    const { invoke, calls } = recordingInvoke();
    const tree = buildNamespaceTree(allowedMethods(EntryKey.client), invoke);
    const leaf = leafAt(tree, Method.AgentGet) as (params?: unknown, options?: object) => Promise<unknown>;
    await leaf({ target: 'a' }, { timeoutMs: 5 });
    assert.deepEqual(calls, [{ method: Method.AgentGet, params: { target: 'a' } }]);
  });

  test('a leaf called without params sends an empty object', async () => {
    const { invoke, calls } = recordingInvoke();
    const tree = buildNamespaceTree(allowedMethods(EntryKey.client), invoke);
    const leaf = leafAt(tree, Method.PaneList) as () => Promise<unknown>;
    await leaf();
    assert.deepEqual(calls, [{ method: Method.PaneList, params: {} }]);
  });

  test('disallowed methods are absent from the client entry', () => {
    const tree = buildNamespaceTree(allowedMethods(EntryKey.client), recordingInvoke().invoke);
    assert.equal(Object.hasOwn(tree, 'server'), true, 'client has server.agent_manifests, so the server branch exists');
    assert.equal(leafAt(tree, Method.ServerStop), undefined);
    assert.equal(leafAt(tree, Method.PaneClose), undefined);
  });

  test('events.subscribe is never a leaf, even when it is allowed', () => {
    const tree = buildNamespaceTree(allowedMethods(EntryKey.client), recordingInvoke().invoke);
    assert.equal(leafAt(tree, Method.EventsSubscribe), undefined);
    assert.equal(typeof leafAt(tree, Method.EventsWait), 'function');
  });

  test('every allowed method is a leaf, and the leaf count is the allow-list size minus events.subscribe', () => {
    for (const entry of Object.values(EntryKey)) {
      const allowed = allowedMethods(entry);
      const expected = [...allowed].filter((method) => method !== Method.EventsSubscribe).sort();
      const tree = buildNamespaceTree(allowed, recordingInvoke().invoke);
      assert.deepEqual(leafNames(tree).sort(), expected, entry);
    }
  });

  test('every generated method name is reachable as a path, so no branch replaced a leaf', () => {
    const everything = new Set<Method>(METHODS.map((spec) => spec.name));
    const tree = buildNamespaceTree(everything, recordingInvoke().invoke);
    for (const spec of METHODS) {
      if (spec.name !== Method.EventsSubscribe) {
        assert.equal(typeof leafAt(tree, spec.name), 'function', spec.name);
      }
    }
  });

  test('the tree is plain frozen objects, not a Proxy', () => {
    const tree = buildNamespaceTree(allowedMethods(EntryKey.client), recordingInvoke().invoke);
    assert.equal(types.isProxy(tree), false);
    assert.equal(Object.isFrozen(tree), true);
    assert.equal(Object.isFrozen(tree.agent), true);
  });

  test('the held tree has client.window_title.set', () => {
    const tree = buildNamespaceTree(allowedMethods(EntryKey.held), recordingInvoke().invoke);
    assert.equal(typeof leafAt(tree, Method.ClientWindowTitleSet), 'function');
  });
});
