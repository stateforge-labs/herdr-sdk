// Role: the per-pane subscription specs for one pane, and the check that the requested types need nothing but pane_id.
// Informs HERDR-ADR-0016 (W6: per-pane types need pane_id) and open issue 8 (pane.output_matched also needs match and source, which watchPaneSet does not take yet).
// TEMPORARY: the TypeError for pane.output_matched is a caller argument error (not a wire error, so not a HerdrError), kept until open issue 8 is amended; then the refusal goes away with it.
import { SubscriptionType } from '../../generated/index.ts';
import { PER_PANE_SUBSCRIPTION_TYPES, WatchText } from '../../../constants.ts';
import type { PerPaneSubscription, PerPaneSubscriptionType } from './types.ts';

// The per-pane types that need only pane_id (every per-pane type except pane.output_matched).
export type PaneIdOnlyType = Exclude<PerPaneSubscriptionType, typeof SubscriptionType.PaneOutputMatched>;

function isPaneIdOnly(type: PerPaneSubscriptionType): type is PaneIdOnlyType {
  return type !== SubscriptionType.PaneOutputMatched;
}

// watchPaneSet's default types: PER_PANE_SUBSCRIPTION_TYPES minus pane.output_matched (open issue 8).
export const DEFAULT_PANE_TYPES: readonly PaneIdOnlyType[] = PER_PANE_SUBSCRIPTION_TYPES.filter(isPaneIdOnly);

// Narrows the caller's types to the ones this lane can subscribe to; a pane.output_matched request is refused, not dropped.
export function checkedPaneTypes(types: readonly PerPaneSubscriptionType[]): readonly PaneIdOnlyType[] {
  return types.map((type) => {
    if (isPaneIdOnly(type)) {
      return type;
    }
    throw new TypeError(WatchText.OutputMatchUnsupported);
  });
}

export function perPaneSpecs(paneId: string, types: readonly PaneIdOnlyType[]): readonly PerPaneSubscription[] {
  return types.map((type) => ({ type, pane_id: paneId }));
}
