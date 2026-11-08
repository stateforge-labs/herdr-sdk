// Role: compile-time check that every long-poll leaf needs its timeout_ms (agent.prompt only inside wait): without it the call does not compile, with it the call does.
// Informs HERDR-ADR-0017 (contract tests, `tsc -p test/types`), HERDR-ADR-0007 and plan 3.6. Compiled, never run.
import type { AdminNamespaces, ClientNamespaces, PromptNamespaces } from '../../../src/herdr/generated/namespaces.ts';

export async function agentWaitNeedsTimeout(herdr: ClientNamespaces): Promise<void> {
  // @ts-expect-error agent.wait without timeout_ms does not compile
  await herdr.agent.wait({ target: 'reviewer' });
  await herdr.agent.wait({ target: 'reviewer', timeout_ms: 1_000 });
}

export async function eventsWaitNeedsTimeout(herdr: ClientNamespaces): Promise<void> {
  // @ts-expect-error events.wait without timeout_ms does not compile
  await herdr.events.wait({ match_event: { event: 'workspace_created' } });
  await herdr.events.wait({ match_event: { event: 'workspace_created' }, timeout_ms: 1_000 });
}

export async function paneWaitForOutputNeedsTimeout(herdr: ClientNamespaces): Promise<void> {
  // @ts-expect-error pane.wait_for_output without timeout_ms does not compile
  await herdr.pane.wait_for_output({ pane_id: 'p1', match: { type: 'substring', value: 'ready' }, source: 'visible' });
  await herdr.pane.wait_for_output({ pane_id: 'p1', match: { type: 'substring', value: 'ready' }, source: 'visible', timeout_ms: 1_000 });
}

export async function agentStartNeedsTimeout(herdr: AdminNamespaces): Promise<void> {
  // @ts-expect-error agent.start without timeout_ms does not compile
  await herdr.agent.start({ kind: 'claude', name: 'reviewer', pane_id: 'p1' });
  await herdr.agent.start({ kind: 'claude', name: 'reviewer', pane_id: 'p1', timeout_ms: 5_000 });
}

export async function agentPromptNeedsTimeoutOnlyInsideWait(herdr: PromptNamespaces): Promise<void> {
  await herdr.agent.prompt({ target: 'reviewer', text: 'run the tests' });
  // @ts-expect-error a prompt with wait still needs timeout_ms inside wait (plan 3.6)
  await herdr.agent.prompt({ target: 'reviewer', text: 'run the tests', wait: { until: [] } });
  await herdr.agent.prompt({ target: 'reviewer', text: 'run the tests', wait: { until: [], timeout_ms: 1_000 } });
}
