// Role: table test of exitCodeFor(): the three outcome kinds map to 0/1/2/3, and NotCovered is never 0.
// Informs HERDR-ADR-0009 (exit codes; "could not look" is 3, never 0); new test for lane P5c.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DriftExitCode, DriftOutcomeKind } from '../../src/constants.ts';
import { exitCodeFor } from '../../src/drift/exit-code.ts';
import type { DriftOutcome, DriftReport } from '../../src/drift/types.ts';

const NO_MOVEMENT = { added: [], removed: [] } as const;

function report(drifted: boolean): DriftReport {
  return {
    protocol: { committed: 22, installed: 22 },
    herdrVersion: { committed: '0.9.5', installed: '0.9.5' },
    methods: NO_MOVEMENT,
    resultTags: NO_MOVEMENT,
    eventKinds: NO_MOVEMENT,
    subscriptionTypes: NO_MOVEMENT,
    changedShapes: [],
    unmappedMethods: [],
    drifted,
  };
}

describe('exitCodeFor', () => {
  const cases: readonly (readonly [string, DriftOutcome, DriftExitCode])[] = [
    ['clean report is 0', { kind: DriftOutcomeKind.Report, report: report(false) }, DriftExitCode.Clean],
    ['drifted report is 1', { kind: DriftOutcomeKind.Report, report: report(true) }, DriftExitCode.Drift],
    ['usage is 2', { kind: DriftOutcomeKind.Usage, message: 'bad flag' }, DriftExitCode.Usage],
    ['not covered is 3', { kind: DriftOutcomeKind.NotCovered, reason: 'herdr is not on PATH' }, DriftExitCode.NotCovered],
  ];
  for (const [name, outcome, expected] of cases) {
    test(name, () => {
      assert.equal(exitCodeFor(outcome), expected);
    });
  }

  test('not covered is never 0', () => {
    assert.notEqual(exitCodeFor({ kind: DriftOutcomeKind.NotCovered, reason: 'x' }), DriftExitCode.Clean);
  });
});
