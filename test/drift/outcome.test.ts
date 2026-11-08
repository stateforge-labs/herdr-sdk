// Role: checks outcomeOf(): any read that could not look is NOT COVERED; two found reads give a report; a malformed schema is NOT COVERED too; outcomeOrNotCovered(): an error thrown while looking is NOT COVERED, never a drift.
// Informs HERDR-ADR-0009 ("could not look" is exit 3, never 0); new test for lane P5c.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DriftOutcomeKind, SchemaReadKind } from '../../src/constants.ts';
import { outcomeOf, outcomeOrNotCovered } from '../../src/drift/diff.ts';
import type { DriftOutcome, SchemaRead } from '../../src/drift/types.ts';
import { miniSchema } from './support/mini-schema.ts';

function found(schema = miniSchema(), herdrVersion = '0.9.5'): SchemaRead {
  return { kind: SchemaReadKind.Found, schema, herdrVersion };
}

const NOT_FOUND: SchemaRead = { kind: SchemaReadKind.NotFound, reason: 'herdr is not on PATH' };
const UNREADABLE: SchemaRead = { kind: SchemaReadKind.Unreadable, reason: 'not JSON' };

describe('outcomeOf', () => {
  test('a committed read that could not look is NOT COVERED with its reason', () => {
    assert.deepEqual(outcomeOf(NOT_FOUND, found()), { kind: DriftOutcomeKind.NotCovered, reason: 'herdr is not on PATH' });
    assert.deepEqual(outcomeOf(UNREADABLE, found()), { kind: DriftOutcomeKind.NotCovered, reason: 'not JSON' });
  });

  test('an installed read that could not look is NOT COVERED', () => {
    assert.equal(outcomeOf(found(), NOT_FOUND).kind, DriftOutcomeKind.NotCovered);
    assert.equal(outcomeOf(found(), UNREADABLE).kind, DriftOutcomeKind.NotCovered);
  });

  test('two found reads give a report', () => {
    const outcome = outcomeOf(found(), found());
    assert.equal(outcome.kind, DriftOutcomeKind.Report);
    assert.equal(outcome.kind === DriftOutcomeKind.Report ? outcome.report.drifted : true, false);
  });

  test('a schema without a required definition is NOT COVERED, not a crash', () => {
    const broken = JSON.parse(JSON.stringify(miniSchema())) as { schemas: { event: { $defs: Record<string, unknown> } } };
    delete broken.schemas.event.$defs.EventData;
    const outcome = outcomeOf(found(), found(broken as never));
    assert.equal(outcome.kind, DriftOutcomeKind.NotCovered);
  });
});

describe('outcomeOrNotCovered', () => {
  test('a look that resolves passes its outcome through', async () => {
    const outcome: DriftOutcome = { kind: DriftOutcomeKind.Usage, message: 'x' };
    assert.deepEqual(await outcomeOrNotCovered(async () => outcome), outcome);
  });

  test('a look that rejects is NOT COVERED with the error message', async () => {
    const outcome = await outcomeOrNotCovered(async () => {
      throw new Error('driftBetween broke');
    });
    assert.deepEqual(outcome, { kind: DriftOutcomeKind.NotCovered, reason: 'driftBetween broke' });
  });

  test('a look that throws synchronously is NOT COVERED with the error message', async () => {
    const outcome = await outcomeOrNotCovered((): Promise<DriftOutcome> => {
      throw new TypeError('not a schema');
    });
    assert.deepEqual(outcome, { kind: DriftOutcomeKind.NotCovered, reason: 'not a schema' });
  });

  test('a thrown value that is not an Error is NOT COVERED with its text', async () => {
    const outcome = await outcomeOrNotCovered(async () => {
      throw 'plain text';
    });
    assert.deepEqual(outcome, { kind: DriftOutcomeKind.NotCovered, reason: 'plain text' });
  });
});
