// Role: README sections 5 and 6 and the drift/effect contracts compile: typed fake replies, drift exit codes, tagged error shapes.
// Informs HERDR-ADR-0008, HERDR-ADR-0009, HERDR-ADR-0017 and plan 3.7, 5, 6. Compiled, never run.
import { connect, Method, ResultTag } from '../../../src/index.ts';
import { createFakeHerdr } from '../../../src/test-kit.ts';
import { DriftExitCode, DriftOutcomeKind, driftBetween, exitCodeFor } from '../../../src/drift.ts';
import { EffectErrorTag, toTaggedError, type HerdrTaggedError } from '../../../src/effect.ts';

export async function fakeTest(): Promise<void> {
  const fake = await createFakeHerdr();
  fake.reply(Method.AgentList, { type: ResultTag.AgentList, agents: [] });
  // @ts-expect-error a reply must match the method's result
  fake.reply(Method.AgentList, { type: ResultTag.Pong });
  const herdr = await connect({ socketPath: fake.path });
  await herdr.agent.list({});
  const methods: readonly string[] = fake.receivedMethods();
  console.log(methods, fake.subscriberCount(), fake.connectionCount(), fake.capabilities, fake.reproduces);
  fake.push({ event: 'not_a_kind', data: {} });
  fake.replySequence(Method.AgentList, [{ error: { code: 'x', message: 'y' } }, { result: { type: ResultTag.AgentList, agents: [] } }]);
  herdr.close();
  await fake.stop();
}

export function drift(): number {
  const report = driftBetween({ schema: {}, herdrVersion: '0.9.5' }, { schema: {}, herdrVersion: '0.9.6' });
  const code: DriftExitCode = exitCodeFor({ kind: DriftOutcomeKind.Report, report });
  const never0: DriftExitCode = exitCodeFor({ kind: DriftOutcomeKind.NotCovered, reason: 'herdr not on PATH' });
  return code + never0 + DriftExitCode.NotCovered;
}

export function effectErrors(error: unknown): string {
  const tagged: HerdrTaggedError = toTaggedError(error);
  switch (tagged._tag) {
    case EffectErrorTag.Refused:
      return tagged.code;
    case EffectErrorTag.Unavailable:
      return String(tagged.isTimeout);
    case EffectErrorTag.ProtocolMismatch:
      return String(tagged.actual);
    case EffectErrorTag.Unsupported:
      return tagged.capability;
  }
}
