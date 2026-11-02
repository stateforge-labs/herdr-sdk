// Role: connectReadOnly() over the fake: writes are absent from the client at runtime and never reach the server, and a read still goes through.
// Informs HERDR-ADR-0005 (read-only is structure reads by default; the allow-list narrows at runtime) and plan 3.4; cross-layer test over createFakeHerdr only.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Method, ResultTag } from '../../src/index.ts';
import { connectReadOnly } from '../../src/read-only.ts';
import type { ReadOnlyOptions } from '../../src/read-only.ts';
import { withFake } from '../support/fake.ts';

// The methods option is typed to the read-only set; a test that names a write passes it through this cast on purpose.
type ReadOnlyMethods = NonNullable<ReadOnlyOptions['methods']>;

describe('connectReadOnly() over the fake', () => {
  test('a write is absent from the default client and nothing but ping reaches the server', async () => {
    await withFake({}, async (fake) => {
      const client = await connectReadOnly({ socketPath: fake.path });
      try {
        assert.equal(Reflect.get(client.workspace, 'create'), undefined);
        assert.equal(Reflect.get(client.pane, 'rename'), undefined);
        assert.equal('call' in client, false);
        assert.deepEqual(fake.receivedMethods(), [Method.Ping]);
      } finally {
        client.close();
      }
    });
  });

  test('a write named in the methods option is dropped, not added', async () => {
    await withFake({}, async (fake) => {
      // watch() needs events.subscribe and session.snapshot in the list (plan 3.4), so both are named here.
      const requested = [
        Method.WorkspaceList,
        Method.WorkspaceCreate,
        Method.EventsSubscribe,
        Method.SessionSnapshot,
      ] as unknown as ReadOnlyMethods;
      const client = await connectReadOnly({ socketPath: fake.path, methods: requested });
      try {
        assert.equal(Reflect.get(client.workspace, 'create'), undefined);
        assert.equal(typeof client.workspace.list, 'function');
      } finally {
        client.close();
      }
    });
  });

  test('a read still reaches the server and returns its result', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.PaneList, { type: ResultTag.PaneList, panes: [] });
      const client = await connectReadOnly({ socketPath: fake.path });
      try {
        const result = await client.pane.list({});
        assert.deepEqual(result, { type: ResultTag.PaneList, panes: [] });
        assert.deepEqual(fake.receivedMethods(), [Method.Ping, Method.PaneList]);
      } finally {
        client.close();
      }
    });
  });
});
