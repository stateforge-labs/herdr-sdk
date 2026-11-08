// Role: builds the subscription specs of types that need no pane_id: watch()'s default and watchPaneSet's lifecycle pair.
// Informs HERDR-ADR-0016 (W6: 24 global types, 3 per-pane) and plan 3.6; the defaults come from constants, never a hand list.
import type { Subscription, SubscriptionType } from '../../generated/index.ts';

// Every type given here is a bare member of Subscription (no pane_id, no match): the callers pass GLOBAL_SUBSCRIPTION_TYPES
// and PANE_LIFECYCLE_SUBSCRIPTION_TYPES, and the watch tests assert each spec has only its type.
export function bareSpecs(types: readonly SubscriptionType[]): readonly Subscription[] {
  return types.map((type) => ({ type }) as Subscription);
}
