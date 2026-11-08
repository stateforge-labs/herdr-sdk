// Role: checks the human lines and the JSON of a drift outcome: clean, ADDED and REMOVED wording, NOT COVERED, and the report as JSON.
// Informs HERDR-ADR-0009 (the report lists added and removed separately) and the atalaya wording it ports; new test for lane P5c.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DriftOutcomeKind } from '../../src/constants.ts';
import { renderJson, renderOutcome } from '../../src/drift/cli.ts';
import { driftBetween } from '../../src/drift/diff.ts';
import { miniSchema } from './support/mini-schema.ts';

describe('renderOutcome', () => {
  test('a clean report is one line that names the protocol', () => {
    const report = driftBetween({ schema: miniSchema(), herdrVersion: '0.9.5' }, { schema: miniSchema(), herdrVersion: '0.9.5' });
    assert.deepEqual(renderOutcome({ kind: DriftOutcomeKind.Report, report }), [
      'herdr-drift: 0 — clean (protocol 22, herdr 0.9.5)',
    ]);
  });

  test('a drifted report names the facet, with ADDED and REMOVED apart', () => {
    const report = driftBetween(
      { schema: miniSchema(), herdrVersion: '0.9.5' },
      { schema: miniSchema({ methods: ['ping', 'pane.new'] }), herdrVersion: '0.9.5' },
    );
    const lines = renderOutcome({ kind: DriftOutcomeKind.Report, report });
    assert.equal(lines[0], 'methods: herdr ADDED 1 the copy lacks: pane.new · herdr REMOVED 1 the copy still has: workspace.list');
    // The installed pane.new has no METHOD_RESULT row, so it is a second finding.
    assert.ok(lines.includes('methods without a METHOD_RESULT row: pane.new'), lines.join('\n'));
    assert.equal(lines.at(-1), 'herdr-drift: 1 — 2 finding(s)');
  });

  test('a protocol move is named', () => {
    const report = driftBetween({ schema: miniSchema(), herdrVersion: '0.9.5' }, { schema: miniSchema({ protocol: 23 }), herdrVersion: '0.9.5' });
    assert.ok(renderOutcome({ kind: DriftOutcomeKind.Report, report }).includes('protocol moved 22 -> 23'));
  });

  test('NOT COVERED names the reason with exit 3', () => {
    assert.deepEqual(renderOutcome({ kind: DriftOutcomeKind.NotCovered, reason: 'herdr is not on PATH' }), [
      'herdr-drift: 3 — NOT COVERED: herdr is not on PATH',
    ]);
  });

  test('usage names the message with exit 2', () => {
    assert.deepEqual(renderOutcome({ kind: DriftOutcomeKind.Usage, message: 'bad' }), ['herdr-drift: 2 — USAGE: bad']);
  });
});

describe('renderJson', () => {
  test('a report prints the DriftReport itself', () => {
    const report = driftBetween({ schema: miniSchema(), herdrVersion: '0.9.5' }, { schema: miniSchema(), herdrVersion: '0.9.5' });
    assert.deepEqual(JSON.parse(renderJson({ kind: DriftOutcomeKind.Report, report })), JSON.parse(JSON.stringify(report)));
  });

  test('a non-report prints the outcome', () => {
    assert.deepEqual(JSON.parse(renderJson({ kind: DriftOutcomeKind.NotCovered, reason: 'x' })), { kind: 'not-covered', reason: 'x' });
  });
});
