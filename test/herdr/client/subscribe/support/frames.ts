// Role: typed builders for full push frames (every field of the generated PushFrame), so the tests never cast a fixture.
// Informs HERDR-ADR-0017 (test fixtures and P3: full results or typed builders, no partial casts) and HERDR-ADR-0016 (W2 pushes carry no id); lane test helper.
import { AgentStatus, EventKind, SubscriptionEventKind, type PushFrame } from '../../../../../src/herdr/generated/index.ts';

export function agentStatusFrame(status: AgentStatus, paneId = 'p1'): PushFrame {
  return {
    event: EventKind.PaneAgentStatusChanged,
    data: { type: EventKind.PaneAgentStatusChanged, agent_status: status, pane_id: paneId, workspace_id: 'w1' },
  };
}

export function scrollFrame(paneId = 'p1'): PushFrame {
  return {
    event: SubscriptionEventKind.PaneScrollChanged,
    data: {
      pane_id: paneId,
      workspace_id: 'w1',
      scroll: { max_offset_from_bottom: 0, offset_from_bottom: 0, viewport_rows: 24 },
    },
  };
}

// A push line whose kind this library does not know: an envelope with an event herdr never sends (P3).
export function unknownKindLine(kind = 'future_kind'): object {
  return { event: kind, data: {} };
}
