// Role: a read-only client has no writes, no call() and no hold(); terminal content needs { content: true }; the preset is narrow. Compiled, never run.
// Informs HERDR-ADR-0005 (negative type fixtures) and plan 3.4; slice P2b.
import { connectReadOnly, Presets } from '../../../src/read-only.ts';

export async function readOnlyHasNoWrites(): Promise<void> {
  const herdr = await connectReadOnly();
  // @ts-expect-error a read-only client has no write method
  await herdr.pane.send_text({ pane_id: 'p_1', text: 'x' });
  // @ts-expect-error a read-only client has no generic call()
  await herdr.call('ping', {});
  // @ts-expect-error a read-only client has no hold()
  await herdr.hold();
}

export async function contentNeedsOptIn(): Promise<void> {
  const herdr = await connectReadOnly();
  // @ts-expect-error terminal content needs { content: true }
  await herdr.pane.read({ pane_id: 'p_1', source: 'visible' });
  const withContent = await connectReadOnly({ content: true });
  await withContent.pane.read({ pane_id: 'p_1', source: 'visible' });
}

export async function presetIsNarrow(): Promise<void> {
  const herdr = await connectReadOnly({ preset: Presets.SessionsReader });
  await herdr.session.snapshot({});
  // @ts-expect-error the SessionsReader preset has no long-poll
  await herdr.agent.wait({ target: 'x', timeout_ms: 1 });
  // @ts-expect-error the SessionsReader preset has no watch
  herdr.watch({ snapshot: () => herdr.session.snapshot({}) });
  // @ts-expect-error the SessionsReader preset has no events
  await herdr.events.wait({ timeout_ms: 1 });
}
