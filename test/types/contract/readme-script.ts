// Role: README sections 1 and 2 compile against the contracts: connect(), namespaced calls, errors, subscribe, long-poll, watch, hold.
// Informs HERDR-ADR-0017 (contract tests, `tsc -p test/types`), HERDR-ADR-0014 and plan 3.3-3.6. Compiled, never run.
import {
  AgentStatus,
  connect,
  EventKind,
  HerdrError,
  ProtocolMismatchError,
  SubscriptionType,
  WatchKind,
} from '../../../src/index.ts';
import { apply, metrics, render } from './_stubs.ts';

export async function smallScript(): Promise<void> {
  const herdr = await connect();
  const { agents } = await herdr.agent.list({});
  for (const agent of agents) console.log(agent.name, agent.agent_status);
  try {
    await herdr.agent.prompt({ target: 'reviewer', text: 'run the tests' });
  } catch (error) {
    if (error instanceof HerdrError) console.error(error.code, error.message);
    else throw error;
  }
  await herdr.pane.list({});
  const setView: (params: Parameters<typeof herdr.agent.view.set>[0]) => Promise<unknown> = herdr.agent.view.set;
  console.log(setView);
  herdr.close();
}

export async function mismatch(): Promise<void> {
  try {
    await connect();
  } catch (error) {
    if (error instanceof ProtocolMismatchError) console.error(`herdr speaks ${error.actual}, this library ${error.expected}`);
  }
}

export async function streams(): Promise<void> {
  const herdr = await connect({ onCall: ({ method, durationMs, outcome }) => metrics.record(method, durationMs, outcome) });

  const subscription = await herdr.events.subscribe([
    { type: SubscriptionType.PaneCreated },
    { type: SubscriptionType.PaneClosed },
    { type: SubscriptionType.PaneAgentStatusChanged, pane_id: 'p_1' },
  ]);
  for await (const frame of subscription) {
    if (frame.event === EventKind.PaneClosed) break;
  }
  subscription.close();

  const done = await herdr.agent.wait({ target: 'reviewer', until: [AgentStatus.Done], timeout_ms: 60_000 });
  console.log(done);

  for await (const change of herdr.watch({ snapshot: () => herdr.session.snapshot({}) })) {
    if (change.kind === WatchKind.Live) render(change.snapshot.snapshot);
    else apply(change.frame);
  }

  await using held = await herdr.hold();
  await held.client.window_title.set({ title: 'review' });
}

export async function longPollTimeoutIsRequired(): Promise<void> {
  const herdr = await connect();
  // @ts-expect-error a long-poll call without timeout_ms does not compile (plan 3.6)
  await herdr.agent.wait({ target: 'reviewer' });
}
