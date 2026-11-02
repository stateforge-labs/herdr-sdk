// Role: connectAdmin() has every method: server control, close, and the generic call() for any method. Compiled, never run.
// Informs HERDR-ADR-0005 (the admin subpath) and plan 3.4; slice P2b.
import { connectAdmin } from '../../../src/admin.ts';
import { Method } from '../../../src/index.ts';

export async function adminHasEverything(): Promise<void> {
  const herdr = await connectAdmin();
  await herdr.server.stop({});
  await herdr.pane.close({ pane_id: 'p_1' });
  await herdr.call(Method.ServerStop, {});
  await herdr.agent.start({} as Parameters<typeof herdr.agent.start>[0]);
}
