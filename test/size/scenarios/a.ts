// Role: size scenario a (plan 10.1 row "a"): a read-only consumer that narrows to one method and calls session.snapshot. Bundled by tools/scripts/check-size.ts, never run.
import { connectReadOnly, Method } from '@stateforge-labs/herdr-sdk/read-only';

export async function scenarioA(): Promise<unknown> {
  const herdr = await connectReadOnly({ methods: [Method.SessionSnapshot] });
  const snapshot = await herdr.session.snapshot({});
  herdr.close();
  return snapshot;
}
