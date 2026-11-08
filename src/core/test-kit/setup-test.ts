// Role: setupTest and openWorld: a fake core plus links and event streams that close with the test.
// Informs HERDR-ADR-0020 (the herdr-core client); ported from the desktop work in herdr-plugins.
import type { TestContext } from 'node:test';
import { duration } from '../kernel/time.ts';
import { CoreEvents } from '../events.ts';
import type { CoreEventsTiming } from '../events.ts';
import { CoreLink } from '../link.ts';
import type { CoreLinkTiming } from '../link.ts';
import type { SocketPath } from '../wire.ts';
import { FakeHcCore } from './fake-core.ts';

export const FAST_LINK: CoreLinkTiming = { helloTimeout: duration(300), backoffBase: duration(40), backoffCap: duration(160) };
export const FAST_EVENTS: CoreEventsTiming = { backoffBase: duration(30), backoffCap: duration(120), silence: duration(5000) };

export interface DesktopWorld {
  readonly core: FakeHcCore;
  readonly path: SocketPath;
  link(timing?: CoreLinkTiming): CoreLink;
  events(timing?: CoreEventsTiming): CoreEvents;
  close(): Promise<void>;
}

export async function openWorld(): Promise<DesktopWorld> {
  const core = await FakeHcCore.start();
  const links = new Set<CoreLink>();
  const streams = new Set<CoreEvents>();
  return {
    core,
    path: core.path,
    link: (timing = FAST_LINK): CoreLink => {
      const made = new CoreLink({ path: core.path, timing });
      links.add(made);
      return made;
    },
    events: (timing = FAST_EVENTS): CoreEvents => {
      const made = new CoreEvents({ path: core.path, timing });
      streams.add(made);
      return made;
    },
    close: async (): Promise<void> => {
      await Promise.all([...streams].map((made) => made.close()));
      await Promise.all([...links].map((made) => made.close()));
      await core.stop();
    },
  };
}

export async function setupTest(t: TestContext): Promise<DesktopWorld> {
  const world = await openWorld();
  t.after(() => world.close());
  return world;
}
