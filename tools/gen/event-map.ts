// Role: pure join of EventKind, subscription type, EventMatch kind and push frame, plus the facts the docs and tests state.
// Informs HERDR-ADR-0007 (subscriptions) and plan section 3.6 (the 26 kinds -> subscription -> EventMatch -> frame mapping).
import { eventKinds, eventMatchKinds, subscriptionEventKinds, subscriptionTypes } from './emit-names.ts';
import type { ApiSchema } from './schema.ts';

export const FrameName = {
  Event: 'EventFrame',
  SubscriptionEvent: 'SubscriptionEventFrame',
} as const;
export type FrameName = (typeof FrameName)[keyof typeof FrameName];

export const NO_VALUE = '—';

export interface EventMapRow {
  readonly kind: string | undefined;          // EventKind, undefined for the two parameterised subscriptions
  readonly subscription: string | undefined;  // subscription type, undefined for pane_output_changed
  readonly eventMatch: boolean;               // true when events.wait can await this kind
  readonly frame: FrameName;
}

// A lifecycle subscription type is the event kind with its first `_` replaced by `.`.
function subscriptionOf(kind: string, subscriptions: readonly string[]): string | undefined {
  const candidate = kind.replace('_', '.');
  return subscriptions.includes(candidate) ? candidate : undefined;
}

// The frame a subscription delivers; a subscription that is in neither shape is a schema fault.
export function frameOf(subscription: string, subscriptionKinds: readonly string[], kind: string | undefined): FrameName {
  if (subscriptionKinds.includes(subscription)) {
    return FrameName.SubscriptionEvent;
  }
  if (kind !== undefined) {
    return FrameName.Event;
  }
  throw new Error(`subscription type '${subscription}' maps to no frame`);
}

// One row per EventKind, then one per subscription type that no kind claims.
export function eventMap(schema: ApiSchema): readonly EventMapRow[] {
  const kinds = eventKinds(schema);
  const subscriptions = subscriptionTypes(schema);
  const subscriptionKinds = subscriptionEventKinds(schema);
  const matchable = eventMatchKinds(schema);
  const fromKinds = kinds.map((kind): EventMapRow => {
    const subscription = subscriptionOf(kind, subscriptions);
    return {
      kind,
      subscription,
      eventMatch: matchable.includes(kind),
      frame: subscription === undefined ? FrameName.Event : frameOf(subscription, subscriptionKinds, kind),
    };
  });
  const claimed = new Set(fromKinds.map((row) => row.subscription));
  const unclaimed = subscriptions
    .filter((subscription) => !claimed.has(subscription))
    .map((subscription): EventMapRow => ({
      kind: undefined,
      subscription,
      eventMatch: false,
      frame: frameOf(subscription, subscriptionKinds, undefined),
    }));
  return [...fromKinds, ...unclaimed];
}

export interface EventFacts {
  readonly kindCount: number;
  readonly subscriptionCount: number;
  readonly notAwaitable: readonly string[];   // kinds with no EventMatch (events.wait cannot await them)
  readonly notSubscribable: readonly string[]; // kinds with no subscription type
  readonly noEventKind: readonly string[];     // subscription types with no EventKind
}

// The counts and exceptions the docs state and the tests assert.
export function eventFacts(rows: readonly EventMapRow[]): EventFacts {
  const kinds = rows.filter((row) => row.kind !== undefined);
  const subscriptions = rows.filter((row) => row.subscription !== undefined);
  return {
    kindCount: kinds.length,
    subscriptionCount: subscriptions.length,
    notAwaitable: kinds.filter((row) => !row.eventMatch).map((row) => row.kind ?? NO_VALUE),
    notSubscribable: kinds.filter((row) => row.subscription === undefined).map((row) => row.kind ?? NO_VALUE),
    noEventKind: rows.filter((row) => row.kind === undefined).map((row) => row.subscription ?? NO_VALUE),
  };
}
