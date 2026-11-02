// Role: connect() has no admin-only, server-control or spawning member; the generic call() is limited to the client entry. Compiled, never run.
// Informs HERDR-ADR-0005 (negative type fixtures) and plan 3.4; slice P2b.
import { connect, Method } from '../../../src/index.ts';

export async function noAdminOnConnect(): Promise<void> {
  const herdr = await connect();
  // @ts-expect-error server.stop is admin-only
  await herdr.server.stop({});
  // @ts-expect-error pane.close is admin-only (class D)
  await herdr.pane.close({ pane_id: 'p_1' });
  // @ts-expect-error agent.start is admin-only (class X)
  await herdr.agent.start({});
  // @ts-expect-error call() on connect() is limited to the client entry
  await herdr.call(Method.ServerStop, {});
  // @ts-expect-error class C methods are only on a held connection
  await herdr.client.window_title.set({ title: 't' });
}
