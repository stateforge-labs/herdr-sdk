// Role: the prompt client has agent.prompt as its only write and no call(), no streams. Compiled, never run.
// Informs HERDR-ADR-0005 (negative type fixtures) and plan 3.4; slice P2b.
import { connectPrompt } from '../../../src/read-only.ts';

export async function promptOnly(): Promise<void> {
  const herdr = await connectPrompt();
  await herdr.agent.prompt({ target: 'x', text: 'y' });
  // @ts-expect-error the prompt client has no other input method
  await herdr.agent.send_keys({ target: 'x', keys: [] });
  // @ts-expect-error the prompt client has no generic call()
  await herdr.call('ping', {});
  // @ts-expect-error the prompt client has no watch()
  herdr.watch({ snapshot: () => herdr.session.snapshot({}) });
}
