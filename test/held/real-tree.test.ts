// Role: hold() over P2b's real buildNamespaceTree and allowedMethods('held'): only the class C leaves exist on a held connection.
// Informs HERDR-ADR-0005 (capability-scoped clients) and plan 3.6; waits for slice P2b-1 (these throw NotImplementedError until it lands, so the test is skipped until then).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedMethods } from '../../src/client/scoped/allowed-methods.ts';
import { buildNamespaceTree } from '../../src/client/scoped/namespace-tree.ts';
import { createHold } from '../../src/client/held/hold.ts';
import { DEFAULT_CAPABILITIES } from '../../src/constants.ts';
import { memoryDedicated } from './support/memory-dedicated.ts';

// True once P2b-1 has landed: the stubs throw until then.
function p2bLanded(): boolean {
  try {
    allowedMethods('held');
    return true;
  } catch {
    return false;
  }
}

describe('held tree over the real builders', () => {
  test('only the class C leaves exist on a held connection', { skip: !p2bLanded() }, async () => {
    const dedicated = memoryDedicated();
    const clientClosed = new AbortController();
    const held = await createHold({
      socketPath: '/unused/herdr.sock',
      timeoutMs: 5000,
      capabilities: DEFAULT_CAPABILITIES,
      open: dedicated.open,
      buildTree: buildNamespaceTree,
      allowedMethods,
      signal: clientClosed.signal,
    })();
    assert.deepEqual(Object.keys(held.client.window_title).sort(), ['clear', 'set']);
    assert.deepEqual(Object.keys(held.server.ssh_agent), ['register']);
    await held.close();
  });
});
