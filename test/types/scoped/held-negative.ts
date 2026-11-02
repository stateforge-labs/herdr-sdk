// Role: a held connection has only the class C methods: window_title.set type-checks, pane.list does not. Compiled, never run.
// Informs HERDR-ADR-0005 (negative type fixtures: members per class set) and plan 3.6 (held connections); slice P2b, spec section 3.
import type { HeldConnection } from '../../../src/index.ts';

export async function heldHasOnlyClassC(held: HeldConnection): Promise<void> {
  await held.client.window_title.set({ title: 'review' });
  // @ts-expect-error held has no pane.list (a class R method is not on a held connection)
  await held.pane.list({});
}
