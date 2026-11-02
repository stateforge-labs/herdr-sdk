// Role: typed DecodedFrame builders for the watch and pane tests (a pane lifecycle pair, an agent status, an unknown kind).
// Informs HERDR-ADR-0016 (W6 lifecycle and per-pane frames; P3 UnknownFrame) and the contracts' test-fixture rule; lane P4b test helper.
import { UNKNOWN_EVENT } from '../../../src/constants.ts';
import { EventKind, SubscriptionEventKind } from '../../../src/generated/index.ts';
import type { AgentStatus, PaneInfo } from '../../../src/generated/events.ts';
import type { DecodedFrame, UnknownFrame } from '../../../src/wire/types.ts';

const WORKSPACE_ID = 'w1';

// A pane.created frame. PaneInfo is partial here (the lifecycle reads only pane_id); cast once, as the fixture rule allows.
export function paneCreated(paneId: string): DecodedFrame {
  const pane = { pane_id: paneId, workspace_id: WORKSPACE_ID } as PaneInfo;
  return { event: EventKind.PaneCreated, data: { type: EventKind.PaneCreated, pane } };
}

export function paneClosed(paneId: string): DecodedFrame {
  return { event: EventKind.PaneClosed, data: { type: EventKind.PaneClosed, pane_id: paneId, workspace_id: WORKSPACE_ID } };
}

export function agentStatus(paneId: string, status: AgentStatus = 'working'): DecodedFrame {
  return {
    event: SubscriptionEventKind.PaneAgentStatusChanged,
    data: { pane_id: paneId, workspace_id: WORKSPACE_ID, agent_status: status },
  };
}

export function unknownFrame(rawEvent: string): UnknownFrame {
  return { event: UNKNOWN_EVENT, rawEvent, raw: { event: rawEvent, data: {} } };
}
