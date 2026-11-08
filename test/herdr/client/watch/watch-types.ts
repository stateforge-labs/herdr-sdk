// Role: compile-time check of W5: watch() has no subscribe-only form, so a call without a snapshot is a type error. Compiled by `bun run typecheck` once tsconfig.test.json covers test/herdr/client/watch (integration item A0).
// Informs HERDR-ADR-0016 (W5) and plan 4b ("snapshot removal fails the suite"); the runtime half is the replay-ordering test in watch.test.ts.
import { createWatch } from '../../../../src/herdr/client/watch/watch.ts';
import type { Subscribe } from '../../../../src/herdr/client/subscribe/types.ts';

declare const subscribe: Subscribe;

const watch = createWatch(subscribe);

// @ts-expect-error W5: a watch without a snapshot does not exist; the snapshot is required.
watch({ subscriptions: [] });

watch({ snapshot: async () => 'present' });
