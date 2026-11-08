// Role: size scenario b (plan 10.1 row "b", fleet): a full client that takes a snapshot, follows panes with watchPaneSet and maps errors with toTaggedError. Bundled by tools/scripts/check-size.ts, never run.
import { connect, watchPaneSet } from '@homelab/herdr';
import { toTaggedError } from '@homelab/herdr/effect';

export async function scenarioB(): Promise<unknown> {
  const herdr = await connect();
  try {
    const snapshot = await herdr.session.snapshot({});
    const fleet = watchPaneSet(herdr);
    fleet.close();
    return snapshot;
  } catch (error) {
    return toTaggedError(error);
  } finally {
    herdr.close();
  }
}
