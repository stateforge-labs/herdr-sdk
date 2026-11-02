// Role: hold() over the fake: one held connection serves class C calls and stays open until close(); a server close or the client close ends it; an unadvertised capability is refused before sending.
// Informs HERDR-ADR-0005 (class C is connection-bound), HERDR-ADR-0007 and HERDR-ADR-0016 (W1 held exception); plan 3.6 ("held stays open then closes"); cross-layer test over createFakeHerdr only.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { connect, HerdrTransportError, Method, ResultTag, UnsupportedByServerError } from '../../src/index.ts';
import { withFake } from '../support/fake.ts';
import { rejectionOf } from '../support/rejection.ts';
import { waitUntil } from '../support/wait.ts';

const WAIT_MS = 1000;

describe('hold() over the fake', () => {
  test('one connection serves the class C calls, stays open, and closes on close()', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.ClientWindowTitleSet, { type: ResultTag.ClientWindowTitle, changed: true, reason: 'set' });
      fake.reply(Method.ClientShellSurfaceSet, { type: ResultTag.ClientShellSurfaceSet, active: true, projection_revision: 1 });
      const client = await connect({ socketPath: fake.path });
      try {
        const held = await client.hold();
        await held.client.window_title.set({ title: 'one' });
        await held.client_shell.surface.set({ active: true });
        assert.equal(fake.connectionCount(), 1);
        assert.equal(fake.heldCount(), 1);
        assert.deepEqual(fake.receivedMethods(), [Method.Ping, Method.ClientWindowTitleSet, Method.ClientShellSurfaceSet]);

        await held.close();
        await waitUntil(() => fake.heldCount() === 0 && fake.connectionCount() === 0, WAIT_MS);
        await held.ended;
      } finally {
        client.close();
      }
    });
  });

  test('a server close ends the held connection, and a later call rejects with HerdrTransportError', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.ClientWindowTitleSet, { type: ResultTag.ClientWindowTitle, changed: true, reason: 'set' });
      const client = await connect({ socketPath: fake.path });
      try {
        const held = await client.hold();
        await held.client.window_title.set({ title: 'before' });
        fake.closeHeld();
        await held.ended;
        const error = await rejectionOf(held.client.window_title.set({ title: 'after' }));
        assert.ok(error instanceof HerdrTransportError);
      } finally {
        client.close();
      }
    });
  });

  test('closing the client ends its held connections', async () => {
    await withFake({}, async (fake) => {
      fake.reply(Method.ClientWindowTitleClear, { type: ResultTag.ClientWindowTitle, changed: false, reason: 'cleared' });
      const client = await connect({ socketPath: fake.path });
      const held = await client.hold();
      assert.equal(fake.heldCount(), 0, 'nothing is held until a class C call is sent');
      await held.client.window_title.clear({});
      assert.equal(fake.heldCount(), 1);
      client.close();
      await held.ended;
      await waitUntil(() => fake.heldCount() === 0, WAIT_MS);
    });
  });

  test('a class C method the server did not advertise is refused before anything is sent', async () => {
    // The pong advertises live_handoff only, so ssh_agent_registration is absent.
    await withFake({ capabilities: { live_handoff: true } }, async (fake) => {
      const client = await connect({ socketPath: fake.path });
      try {
        const held = await client.hold();
        const error = await rejectionOf(held.server.ssh_agent.register({ socket_path: '/run/agent.sock' }));
        assert.ok(error instanceof UnsupportedByServerError);
        assert.equal(fake.receivedMethods().includes(Method.ServerSshAgentRegister), false);
        await held.close();
      } finally {
        client.close();
      }
    });
  });
});
