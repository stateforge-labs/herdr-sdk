// Role: nested namespaces type-check with the generated params and results (pane.list, agent.view.set, the held tree). Compiled, never run.
// Informs HERDR-ADR-0002 (generated types) and plan 3.3; slice P2b.
import { connect } from '../../../src/index.ts';
import { connectReadOnly, Presets } from '../../../src/read-only.ts';
import type { HeldConnection } from '../../../src/index.ts';

export async function nested(): Promise<void> {
  const herdr = await connect();
  await herdr.pane.list({});
  await herdr.agent.view.set({ source: 'reviewers', sort: [{ field: 'attention' }] });
  await herdr.agent.view.clear({});
  const reader = await connectReadOnly({ preset: Presets.SessionsReader });
  await reader.pane.get({ pane_id: 'p_1' });
}

export async function heldTree(held: HeldConnection): Promise<void> {
  await held.client.window_title.set({ title: 'review' });
  // @ts-expect-error a held connection has only class C methods, no pane.list
  await held.pane.list({});
}
