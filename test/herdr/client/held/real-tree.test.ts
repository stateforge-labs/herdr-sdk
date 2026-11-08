// Role: hold() over the real buildNamespaceTree and allowedMethods(ENTRY_METHODS.held): only the class C leaves exist on a held connection.
// Informs HERDR-ADR-0005 (capability-scoped clients) and plan 3.6; runs on the real builders (P2b-1 has landed).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ENTRY_METHODS } from '../../../../src/herdr/generated/index.ts';
import { allowedMethods } from '../../../../src/herdr/client/scoped.ts';
import { buildNamespaceTree } from '../../../../src/herdr/client/scoped.ts';
import { createHold } from '../../../../src/herdr/client/held.ts';
import { DEFAULT_CAPABILITIES } from '../../../../src/constants.ts';
import { memoryDedicated } from './support/memory-dedicated.ts';

describe('held tree over the real builders', () => {
  test('only the class C leaves exist on a held connection', async () => {
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
