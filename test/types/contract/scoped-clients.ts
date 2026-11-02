// Role: the capability-scoped client types hold: read-only has no writes and no call(), connect() has no admin methods, presets are narrow.
// Informs HERDR-ADR-0005 (negative type fixtures), HERDR-ADR-0017 and plan 3.4. Compiled, never run.
import { connect, Method } from '../../../src/index.ts';
import { connectAdmin } from '../../../src/admin.ts';
import { connectPrompt, connectReadOnly, Presets } from '../../../src/read-only.ts';

export async function readOnly(): Promise<void> {
  const herdr = await connectReadOnly({ preset: Presets.SessionsReader });
  const snapshot = await herdr.session.snapshot({});
  console.log(snapshot);
  // @ts-expect-error a read-only client has no write methods
  await herdr.agent.prompt({ target: 'x', text: 'y' });
  // @ts-expect-error the SessionsReader preset has no long-poll
  await herdr.agent.wait({ target: 'x', timeout_ms: 1 });
}

export async function readOnlyDefault(): Promise<void> {
  const herdr = await connectReadOnly();
  await herdr.agent.wait({ target: 'x', timeout_ms: 1_000 });
  // @ts-expect-error a read-only client has no generic call()
  await herdr.call(Method.AgentList, {});
  // @ts-expect-error terminal content needs { content: true }
  await herdr.pane.read({ pane_id: 'p_1' });
  // @ts-expect-error a read-only client has no hold()
  await herdr.hold();
  herdr.watch({ snapshot: () => herdr.session.snapshot({}) }).close();
}

export async function readOnlyContent(): Promise<void> {
  const herdr = await connectReadOnly({ content: true });
  await herdr.pane.read({ pane_id: 'p_1' } as Parameters<typeof herdr.pane.read>[0]);
  const narrowed = await connectReadOnly({ methods: [Method.AgentList, Method.SessionSnapshot] });
  await narrowed.agent.list({});
}

export async function prompt(): Promise<void> {
  const herdr = await connectPrompt();
  await herdr.agent.prompt({ target: 'x', text: 'y' });
  // @ts-expect-error the prompt client has no other input method
  await herdr.agent.send_keys({ target: 'x', keys: [] });
}

export async function noAdminOnConnect(): Promise<void> {
  const herdr = await connect();
  // @ts-expect-error server.stop is admin-only
  await herdr.server.stop({});
  // @ts-expect-error pane.close is admin-only (class D)
  await herdr.pane.close({ pane_id: 'p_1' });
  // @ts-expect-error agent.start is admin-only (class X)
  await herdr.agent.start({});
  // @ts-expect-error call() on connect() is limited to its own methods
  await herdr.call(Method.ServerStop, {});
  // @ts-expect-error class C methods are only on a held connection
  await herdr.client.window_title.set({ title: 't' });
}

export async function admin(): Promise<void> {
  const herdr = await connectAdmin();
  await herdr.server.stop({} as Parameters<typeof herdr.server.stop>[0]);
  await herdr.call(Method.ServerStop, {} as Parameters<typeof herdr.server.stop>[0] & object);
}
