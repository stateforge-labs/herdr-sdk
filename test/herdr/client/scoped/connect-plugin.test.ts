// Role: connectPlugin() against its own fake herdr: the plugin pane methods answer typed results, the connect() surface still works, and the methods outside the plugin list never reach the wire.
// Informs HERDR-ADR-0005 (runtime allow-list) and plan G3; the plugin list is the connect() list plus plugin.pane.open, focus and close.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Method } from '../../../../src/herdr/generated/index.ts';
import { PLUGIN_METHODS } from '../../../../src/herdr/generated/entries/plugin.ts';
import { ADMIN_METHODS } from '../../../../src/herdr/generated/entries/admin.ts';
import { CLIENT_METHODS } from '../../../../src/herdr/generated/entries/client.ts';
import type { ResultOf } from '../../../../src/herdr/wire/types.ts';
import { HerdrTransportError } from '../../../../src/herdr/errors.ts';
import { connectPlugin } from '../../../../src/herdr/client/connect.ts';
import { withFake } from '../../../support/fake.ts';
import { rejectionOf } from '../../../support/rejection.ts';

const AGENT_LIST = { type: 'agent_list', agents: [] } as unknown as ResultOf<typeof Method.AgentList>;
const PANE_OPENED = {
  type: 'plugin_pane_opened',
  plugin_pane: {
    plugin_id: 'omarchylab',
    entrypoint: 'main',
    pane: { pane_id: 'p_9', tab_id: 't_1', workspace_id: 'w_1', terminal_id: 'term_9', focused: true, revision: 1, agent_status: 'idle' },
  },
} as unknown as ResultOf<typeof Method.PluginPaneOpen>;

const PLUGIN_ONLY = [Method.PluginPaneOpen, Method.PluginPaneFocus, Method.PluginPaneClose] as const;
const OUTSIDE = [Method.PaneClose, Method.ServerStop, Method.PluginLink, Method.PluginEnable, Method.AgentStart] as const;

describe('PLUGIN_METHODS', () => {
  test('is the client list plus the three plugin pane methods', () => {
    assert.deepEqual([...PLUGIN_METHODS].sort(), [...new Set([...CLIENT_METHODS, ...PLUGIN_ONLY])].sort());
  });

  test('is a subset of the admin list', () => {
    const admin = new Set<string>(ADMIN_METHODS);
    for (const method of PLUGIN_METHODS) {
      assert.equal(admin.has(method), true, `${method} is not an admin method`);
    }
  });

  test('leaves out the admin-only methods', () => {
    for (const method of OUTSIDE) {
      assert.equal((PLUGIN_METHODS as readonly string[]).includes(method), false, `${method} is in the plugin list`);
    }
  });
});

describe('connectPlugin', () => {
  test('answers ping, resolves with the server it found, and exposes watch and hold', async () => {
    await withFake({}, async (fake) => {
      const herdr = await connectPlugin({ socketPath: fake.path });
      assert.equal(typeof herdr.serverInfo.protocol, 'number');
      await herdr.ping({});
      assert.equal(typeof herdr.watch, 'function');
      assert.equal(typeof herdr.hold, 'function');
      herdr.close();
    });
  });

  test('plugin.pane.open resolves with the typed plugin_pane_opened result', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.PluginPaneOpen, PANE_OPENED);
      const herdr = await connectPlugin({ socketPath: fake.path });
      const opened = await herdr.plugin.pane.open({ plugin_id: 'omarchylab', entrypoint: 'main' });
      assert.equal(opened.type, 'plugin_pane_opened');
      assert.equal(opened.plugin_pane.pane.pane_id, 'p_9');
      herdr.close();
    });
  });

  test('the connect() methods still answer, agent.list for one', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.AgentList, AGENT_LIST);
      const herdr = await connectPlugin({ socketPath: fake.path });
      const listed = await herdr.agent.list({});
      assert.equal(listed.type, 'agent_list');
      herdr.close();
    });
  });

  test('call() refuses the methods outside the plugin list before sending them', async () => {
    await withFake({}, async (fake) => {
      const herdr = await connectPlugin({ socketPath: fake.path });
      for (const method of OUTSIDE) {
        const error = await rejectionOf(herdr.call(method, {}));
        assert.ok(error instanceof HerdrTransportError, `${method} should be refused`);
      }
      const sent = fake.receivedMethods();
      for (const method of OUTSIDE) {
        assert.equal(sent.includes(method), false, `${method} reached the wire`);
      }
      herdr.close();
    });
  });

  test('every method that reaches the wire is in the plugin list', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.PluginPaneOpen, PANE_OPENED);
      fake.reply(Method.AgentList, AGENT_LIST);
      const herdr = await connectPlugin({ socketPath: fake.path });
      await herdr.plugin.pane.open({ plugin_id: 'omarchylab', entrypoint: 'main' });
      await herdr.agent.list({});
      const allowed = new Set<string>(PLUGIN_METHODS);
      for (const sent of fake.receivedMethods()) {
        assert.equal(allowed.has(sent), true, `${sent} is not in the plugin entry`);
      }
      herdr.close();
    });
  });
});
