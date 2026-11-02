// Role: the lazy boundary of the streams: events.subscribe, watch() and hold() load streams.ts through a dynamic import the first time one of them is used.
// A client that never streams carries none of that code; the chunk is measured as the "lazy" row of the size table (plan 10.1 step 3).
// Informs HERDR-ADR-0015 (lazy row budget) and plan 3.3; contract in client/types.ts (StreamMembers).
import type { Hold, HeldConnection, HoldOptions } from '../held/types.ts';
import type { Subscribe } from '../subscribe/types.ts';
import type { Watch, WatchChange, WatchFn, WatchOptions } from '../watch/types.ts';
import type { CoreClient, StreamMembers } from '../types.ts';

// One load per client: the first member used starts the import, every later one awaits the same promise.
export function lazyStreams(core: CoreClient): StreamMembers {
  let loaded: Promise<StreamMembers> | undefined;
  const load = (): Promise<StreamMembers> => {
    loaded ??= import('./streams.ts').then((module) => module.createStreamMembers(core));
    return loaded;
  };
  const subscribe: Subscribe = async (specs, options) => {
    const members = await load();
    return members.subscribe(specs, options);
  };
  const hold: Hold = async (options?: HoldOptions): Promise<HeldConnection> => {
    const members = await load();
    return members.hold(options);
  };
  return { subscribe, watch: lazyWatch(load), hold };
}

// watch() is synchronous, so it returns at once; the real watch is created when iteration starts, as the real one does. close() before that ends the iteration without creating it.
function lazyWatch(load: () => Promise<StreamMembers>): WatchFn {
  return function watch<S>(options: WatchOptions<S>): Watch<S> {
    let stopped = false;
    let inner: Watch<S> | undefined;
    async function* changes(): AsyncGenerator<WatchChange<S>> {
      const members = await load();
      if (stopped) {
        return;
      }
      inner = members.watch(options);
      yield* inner;
    }
    return {
      close(): void {
        stopped = true;
        inner?.close();
      },
      [Symbol.asyncIterator]: changes,
    };
  };
}
