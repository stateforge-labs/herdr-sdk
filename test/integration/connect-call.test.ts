// Role: connect() over the fake, end to end: the handshake, a namespaced call, the generic call(), the capabilities a pong carries, and a refused call.
// Informs HERDR-ADR-0005 (capability-scoped clients), HERDR-ADR-0016 (W1 one request per connection) and plan 3.3; cross-layer test over createFakeHerdr only.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { connect, HerdrError, Method, PROTOCOL, ResultTag } from '../../src/index.ts';
import { withFake } from '../support/fake.ts';
import { rejectionOf } from '../support/rejection.ts';

const FAKE_VERSION = '9.9.9-integration';

describe('connect() over the fake', () => {
  test('the handshake reports the server, and a namespaced call reaches the server as one request', async () => {
    await withFake({ version: FAKE_VERSION }, async (fake) => {
      fake.reply(Method.PaneList, { type: ResultTag.PaneList, panes: [] });
      const client = await connect({ socketPath: fake.path });
      try {
        assert.equal(client.serverInfo.protocol, PROTOCOL);
        assert.equal(client.serverInfo.version, FAKE_VERSION);
        const result = await client.pane.list({});
        assert.deepEqual(result, { type: ResultTag.PaneList, panes: [] });
        assert.deepEqual(fake.receivedMethods(), [Method.Ping, Method.PaneList]);
        assert.deepEqual(fake.requests()[1]?.params, {});
      } finally {
        client.close();
      }
    });
  });

  test('call() is the generic escape hatch and reaches the same method', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.WorkspaceList, { type: ResultTag.WorkspaceList, workspaces: [] });
      const client = await connect({ socketPath: fake.path });
      try {
        const result = await client.call(Method.WorkspaceList, {});
        assert.deepEqual(result, { type: ResultTag.WorkspaceList, workspaces: [] });
        assert.equal(fake.receivedMethods().at(-1), Method.WorkspaceList);
      } finally {
        client.close();
      }
    });
  });

  test('a pong that advertises no capabilities gives the client an empty capability set', async () => {
    await withFake({ capabilities: null }, async (fake) => {
      const client = await connect({ socketPath: fake.path });
      try {
        assert.deepEqual({ ...client.capabilities }, {});
      } finally {
        client.close();
      }
    });
  });

  test('a refused call rejects with HerdrError carrying the method and the code', async () => {
    await withFake({}, async (fake) => {
      fake.fail(Method.PaneList, { code: 'pane_not_found', message: 'no such pane' });
      const client = await connect({ socketPath: fake.path });
      try {
        const error = await rejectionOf(client.pane.list({}));
        assert.ok(error instanceof HerdrError);
        assert.equal(error.method, Method.PaneList);
        assert.equal(error.code, 'pane_not_found');
      } finally {
        client.close();
      }
    });
  });

  test('a closed client refuses the next call without contacting the server', async () => {
    await withFake({}, async (fake) => {
      const client = await connect({ socketPath: fake.path });
      client.close();
      await rejectionOf(client.pane.list({}));
      assert.deepEqual(fake.receivedMethods(), [Method.Ping]);
    });
  });
});
