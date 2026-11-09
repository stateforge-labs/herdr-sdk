// Role: README samples for the herdr-core roster and for plugin authors compile against the contracts. Compiled, never run.
import { ErrorCode, HerdrError, connectPlugin } from '../../../src/index.ts';
import { CoreEvents, CoreLink, CoreRoster, CoreTerminals, RosterChange, hcCoreSocketPath, isUnknown } from '../../../src/core.ts';

export async function roster(): Promise<void> {
  const path = hcCoreSocketPath();
  const link = new CoreLink({ path });
  const events = new CoreEvents({ path });
  const table = new CoreRoster();

  const listing = await new CoreTerminals(link).list();
  if (!isUnknown(listing)) table.load(listing.terminals);

  events.start();
  for await (const feed of events.feed) {
    for (const delta of table.fold(feed).deltas) {
      if (delta.kind === RosterChange.Removed) console.log('gone', delta.terminal.address);
      else console.log(delta.kind, delta.terminal.tab, delta.terminal.status);
    }
  }
}

export async function plugin(): Promise<void> {
  const herdr = await connectPlugin();
  try {
    const opened = await herdr.plugin.pane.open({ plugin_id: 'example-plugin', entrypoint: 'panel', placement: 'split', direction: 'right' });
    await herdr.plugin.pane.close({ pane_id: opened.plugin_pane.pane.pane_id });
  } catch (error) {
    if (error instanceof HerdrError && error.code === ErrorCode.AgentBlocked) console.error('blocked');
    else throw error;
  } finally {
    herdr.close();
  }
}
