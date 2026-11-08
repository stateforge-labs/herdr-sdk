// Role: each public connect function against its own fake herdr: the shape it returns, the refusal of a method outside its list, and that nothing outside the list reaches the wire.
// Informs HERDR-ADR-0005 (the runtime allow-list, fake.receivedMethods() is a subset) and plan 3.4; slice P2b. Long-poll calls are not sent here (P4a owns their timeouts).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Method, PRESET_METHODS, ENTRY_METHODS, PROTOCOL } from '../../../../src/herdr/generated/index.ts';
import type { ResultOf } from '../../../../src/herdr/wire/types.ts';
import { HerdrTransportError } from '../../../../src/herdr/errors.ts';
import { connect } from '../../../../src/herdr/client/connect.ts';
import { connectAdmin } from '../../../../src/herdr/client/scoped.ts';
import { connectPrompt } from '../../../../src/herdr/client/scoped.ts';
import { connectReadOnly } from '../../../../src/herdr/client/scoped.ts';
import { Presets } from '../../../../src/constants.ts';
import { withFake } from '../../../support/fake.ts';
import { rejectionOf } from '../../../support/rejection.ts';

// Partial fixtures: the tests check which methods reached the wire, not the result shapes (fake.reply is typed per method).
const AGENT_LIST = { type: 'agent_list', agents: [] } as unknown as ResultOf<typeof Method.AgentList>;
const PANE_LIST = { type: 'pane_list', panes: [] } as unknown as ResultOf<typeof Method.PaneList>;
const SNAPSHOT = { type: 'session_snapshot', snapshot: {} } as unknown as ResultOf<typeof Method.SessionSnapshot>;

function allowedWithPing(names: readonly string[]): Set<string> {
  return new Set([...names, Method.Ping]);
}

describe('connect (full entry)', () => {
  test('answers ping and reports the server it found', async () => {
    await withFake({}, async (fake) => {
      const herdr = await connect({ socketPath: fake.path });
      assert.equal(herdr.serverInfo.protocol, PROTOCOL);
      await herdr.ping({});
      herdr.close();
    });
  });

  test('call() refuses server.stop before sending, and the wire never sees it', async () => {
    await withFake({}, async (fake) => {
      const herdr = await connect({ socketPath: fake.path });
      const error = await rejectionOf(herdr.call(Method.ServerStop, {}));
      assert.ok(error instanceof HerdrTransportError);
      assert.equal(fake.receivedMethods().includes(Method.ServerStop), false);
      herdr.close();
    });
  });

  test('a mixed script reaches the wire only with allowed methods', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.AgentList, AGENT_LIST);
      fake.reply(Method.PaneList, PANE_LIST);
      const herdr = await connect({ socketPath: fake.path });
      await herdr.agent.list({});
      await herdr.pane.list({});
      await rejectionOf(herdr.call(Method.PaneClose, { pane_id: 'p_1' }));
      const allowed = new Set<string>(ENTRY_METHODS.client);
      for (const sent of fake.receivedMethods()) {
        assert.equal(allowed.has(sent), true, `${sent} is not in the client entry`);
      }
      herdr.close();
    });
  });
});

describe('connectAdmin', () => {
  test('has server.stop as a leaf and call() reaches it', async () => {
    await withFake({}, async (fake) => {
      const herdr = await connectAdmin({ socketPath: fake.path });
      assert.equal(typeof herdr.server.stop, 'function');
      herdr.close();
    });
  });
});

describe('connectPrompt', () => {
  test('has agent.prompt, no call(), and sends nothing outside its list', async () => {
    await withFake({}, async (fake) => {
      const herdr = await connectPrompt({ socketPath: fake.path });
      assert.equal('call' in herdr, false);
      assert.equal('watch' in herdr, false);
      assert.equal(typeof herdr.agent.prompt, 'function');
      herdr.close();
      assert.deepEqual(fake.receivedMethods(), [Method.Ping]);
    });
  });
});

describe('connectReadOnly', () => {
  test('the default form lists agents and sends only read-only methods', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.AgentList, AGENT_LIST);
      const herdr = await connectReadOnly({ socketPath: fake.path });
      await herdr.agent.list({});
      const allowed = allowedWithPing(ENTRY_METHODS.readOnly);
      for (const sent of fake.receivedMethods()) {
        assert.equal(allowed.has(sent), true, `${sent} is not in the readOnly entry`);
      }
      herdr.close();
    });
  });

  test('content: true adds pane.read to the read-only client', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.PaneRead, { type: 'pane_read', text: '' } as unknown as ResultOf<typeof Method.PaneRead>);
      const herdr = await connectReadOnly({ socketPath: fake.path, content: true });
      await herdr.pane.read({ pane_id: 'p_1', source: 'visible' });
      assert.deepEqual(fake.receivedMethods(), [Method.Ping, Method.PaneRead]);
      herdr.close();
    });
  });

  test('the preset form has exactly the SessionsReader methods and no streams', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.SessionSnapshot, SNAPSHOT);
      fake.reply(Method.PaneList, PANE_LIST);
      const herdr = await connectReadOnly({ socketPath: fake.path, preset: Presets.SessionsReader });
      await herdr.session.snapshot({});
      await herdr.pane.list({});
      assert.equal('watch' in herdr, false);
      const allowed = allowedWithPing(PRESET_METHODS.SessionsReader);
      for (const sent of fake.receivedMethods()) {
        assert.equal(allowed.has(sent), true, `${sent} is not in the preset`);
      }
      herdr.close();
    });
  });

  test('a method list without session.snapshot is refused at connect (watch needs it)', async () => {
    await withFake({}, async (fake) => {
      const error = await rejectionOf(connectReadOnly({ socketPath: fake.path, methods: [Method.AgentList] }));
      assert.ok(error instanceof HerdrTransportError);
    });
  });

  test('a method list without events.subscribe is refused at connect, and nothing but ping is sent', async () => {
    await withFake({}, async (fake) => {
      const error = await rejectionOf(
        connectReadOnly({ socketPath: fake.path, methods: [Method.AgentList, Method.SessionSnapshot] }),
      );
      assert.ok(error instanceof HerdrTransportError);
      assert.deepEqual(fake.receivedMethods(), [Method.Ping]);
    });
  });

  test('a method list narrows the client: methods outside it are not branches of the client', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.AgentList, AGENT_LIST);
      const herdr = await connectReadOnly({
        socketPath: fake.path,
        methods: [Method.AgentList, Method.SessionSnapshot, Method.EventsSubscribe],
      });
      await herdr.agent.list({});
      assert.equal('pane' in herdr, false, 'no pane branch when pane.list is not listed');
      assert.deepEqual(fake.receivedMethods(), [Method.Ping, Method.AgentList]);
      herdr.close();
    });
  });
});
