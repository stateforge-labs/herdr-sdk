// Role: tests of the pure event join (tools/gen/event-map.ts) against the committed schema.
// Informs HERDR-ADR-0007 and plan section 3.6 (the coverage facts for events.md).
import { describe, expect, test } from 'bun:test';
import { eventFacts, eventMap, FrameName } from '../../../tools/gen/event-map.ts';
import { GEN_PATHS, loadSchema } from '../../../tools/gen/schema.ts';

const schema = loadSchema(GEN_PATHS.schemaPath);
const rows = eventMap(schema);
const facts = eventFacts(rows);

const NOT_AWAITABLE = [
  'workspace_metadata_updated', 'workspace_reordered', 'worktree_created', 'worktree_opened',
  'worktree_removed', 'pane_updated', 'layout_updated',
];

describe('event join', () => {
  test('26 kinds and 27 subscription types', () => {
    expect(facts.kindCount).toBe(26);
    expect(facts.subscriptionCount).toBe(27);
  });

  test('every subscription type maps to exactly one frame', () => {
    for (const row of rows.filter((candidate) => candidate.subscription !== undefined)) {
      expect([FrameName.Event, FrameName.SubscriptionEvent]).toContain(row.frame);
    }
  });

  test('the seven kinds that events.wait cannot await are the plan 3.6 list', () => {
    expect([...facts.notAwaitable].sort()).toEqual([...NOT_AWAITABLE].sort());
  });

  test('pane_output_changed has no subscription type', () => {
    expect(facts.notSubscribable).toEqual(['pane_output_changed']);
  });

  test('pane.output_matched and pane.scroll_changed have no EventKind', () => {
    expect([...facts.noEventKind].sort()).toEqual(['pane.output_matched', 'pane.scroll_changed']);
  });

  test('pane_agent_status_changed is a subscription delivered as a SubscriptionEventFrame', () => {
    const row = rows.find((candidate) => candidate.kind === 'pane_agent_status_changed');
    expect(row?.frame).toBe(FrameName.SubscriptionEvent);
  });
});
