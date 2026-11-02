// Role: the hand-kept subscription lists in constants.ts equal the generated per-pane union, both ways, so they cannot drift from the schema.
// Informs HERDR-ADR-0016 (W6 per-pane types), HERDR-ADR-0017 (contract tests) and plan 3.6 (watch defaults). Compiled, never run.
import { GLOBAL_SUBSCRIPTION_TYPES, PER_PANE_SUBSCRIPTION_TYPES } from '../../../src/constants.ts';
import type { SubscriptionType } from '../../../src/index.ts';
import type { PerPaneSubscriptionType } from '../../../src/client/watch/types.ts';

type Listed = (typeof PER_PANE_SUBSCRIPTION_TYPES)[number];
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const perPaneListIsExact: Equal<Listed, PerPaneSubscriptionType> = true;
export const globalListIsSubscriptionTypes: readonly SubscriptionType[] = GLOBAL_SUBSCRIPTION_TYPES;
