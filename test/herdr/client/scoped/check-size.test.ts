// Role: the size gate's comparison, formatting and leak rules on fixed numbers and input lists (pure; no bundle is built here).
// Informs plan 10.1 and HERDR-ADR-0005 (read-only never pulls admin or effect); HERDR-ADR-0015 (budgets per scenario).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SizeBudget, SizeNote, SizeRow } from '../../../../tools/scripts/size-constants.ts';
import { formatRow, isOverBudget, rowFails, rowLeaks, type SizeRowResult } from '../../../../tools/scripts/check-size.ts';
import { ALWAYS_FORBIDDEN, type Measurement } from '../../../../tools/scripts/size-measure.ts';

const measured = (inputs: readonly string[], emitted = ''): Measurement => ({ bytes: 0, lazyBytes: 0, inputs, emitted });
const result = (bytes: number, budget: number | undefined, leaks: readonly string[] = []): SizeRowResult => ({
  row: SizeRow.Core,
  bytes,
  budget,
  leaks,
});

describe('isOverBudget', () => {
  test('a size above its budget is over; at or below is not', () => {
    assert.equal(isOverBudget(101, 100), true);
    assert.equal(isOverBudget(100, 100), false);
    assert.equal(isOverBudget(99, 100), false);
  });

  test('a row without a budget is never over', () => {
    assert.equal(isOverBudget(1_000_000, undefined), false);
  });
});

describe('rowLeaks', () => {
  test('a clean production row has no leaks', () => {
    assert.deepEqual(rowLeaks(measured(['dist/index.js', 'dist/herdr/client/connect.js']), false), []);
  });

  test('test-kit, test data, drift data and the method tables are forbidden everywhere', () => {
    const inputs = [
      'dist/herdr/test-kit/fake-herdr.js',
      'dist/herdr/generated/test-data/defaults.js',
      'dist/herdr/generated/drift/shapes.js',
      'dist/herdr/generated/method-table.js',
      'dist/herdr/generated/entry-methods.js',
    ];
    assert.deepEqual(rowLeaks(measured(inputs), false), inputs);
  });

  test('child_process in the emitted text is a leak', () => {
    assert.deepEqual(rowLeaks(measured([], 'import{execFileSync}from"node:child_process"'), false), ['child_process']);
  });

  test('a read-only row also refuses admin, connect-admin and effect inputs', () => {
    const inputs = ['dist/read-only.js', 'dist/admin.js', 'dist/herdr/client/scoped/connect-admin.js', 'dist/herdr/effect/to-tagged-error.js'];
    assert.deepEqual(rowLeaks(measured(inputs), true), inputs.slice(1));
    assert.deepEqual(rowLeaks(measured(inputs), false), []);
  });

  test('every always-forbidden fragment is a non-empty string', () => {
    assert.ok(ALWAYS_FORBIDDEN.every((fragment) => fragment.length > 0));
  });
});

describe('rowFails and formatRow', () => {
  test('a row fails when it is over budget or leaks, and passes otherwise', () => {
    assert.equal(rowFails(result(101, 100)), true);
    assert.equal(rowFails(result(100, 100, ['x'])), true);
    assert.equal(rowFails(result(100, 100)), false);
    assert.equal(rowFails(result(1, undefined)), false);
  });

  test('prints the row, the bytes, the budget and the status', () => {
    const line = formatRow({ row: SizeRow.ReadOnly, bytes: 120, budget: 150, leaks: [] });
    assert.match(line, /dist \/read-only\s+120 B\s+budget 150\s+ok/);
  });

  test('marks an over-budget row, a leak and a row without a budget', () => {
    assert.match(formatRow(result(200, 150)), new RegExp(SizeNote.Over));
    assert.match(formatRow(result(100, 150, ['test-kit'])), new RegExp(`${SizeNote.Leak}.*test-kit`));
    assert.match(formatRow(result(100, undefined)), new RegExp(SizeNote.NoBudget));
  });
});

describe('SizeBudget', () => {
  test('budgets the dist rows, the lazy row and the four scenarios, and no measured-only row', () => {
    assert.deepEqual(Object.keys(SizeBudget).sort(), [
      SizeRow.Core,
      SizeRow.Admin,
      SizeRow.Effect,
      SizeRow.Lazy,
      SizeRow.ReadOnly,
      SizeRow.ScenarioA,
      SizeRow.ScenarioAPreset,
      SizeRow.ScenarioB,
      SizeRow.ScenarioC,
    ].sort());
  });
});
