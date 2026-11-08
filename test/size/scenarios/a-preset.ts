// Role: size scenario a-preset (plan 10.1 row "a-preset"): a read-only consumer on the SessionsReader preset, with no Method import. Bundled by tools/scripts/check-size.ts, never run.
import { connectReadOnly, Presets } from '@homelab/herdr/read-only';

export async function scenarioAPreset(): Promise<unknown> {
  const herdr = await connectReadOnly({ preset: Presets.SessionsReader });
  const snapshot = await herdr.session.snapshot({});
  herdr.close();
  return snapshot;
}
