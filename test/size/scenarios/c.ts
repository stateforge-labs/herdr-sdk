// Role: size scenario c (plan 10.1 row "c", script): a full client that lists workspaces and takes a snapshot. Bundled by tools/scripts/check-size.ts, never run.
import { connect } from '@homelab/herdr';

export async function scenarioC(): Promise<unknown> {
  const herdr = await connect();
  const workspaces = await herdr.workspace.list({});
  const snapshot = await herdr.session.snapshot({});
  herdr.close();
  return [workspaces, snapshot];
}
