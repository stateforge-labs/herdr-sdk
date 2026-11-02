// Role: the size gate's comparison and leak rules on fixed numbers and input lists (pure; no bundle is built here).
// Informs plan 10.1 and HERDR-ADR-0005 (read-only never pulls admin or effect); slice P2b.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SizeBudget, SizeEntry } from '../../src/constants.ts';
import { formatRow, forbiddenInputs, isOverBudget, type SizeRow } from '../../scripts/check-size.ts';

const row = (bytes: number, budget: number | undefined): SizeRow => ({ entry: 'x', bytes, budget, note: undefined });

describe('isOverBudget', () => {
  test('a size above its budget is over; at or below is not', () => {
    assert.equal(isOverBudget(row(101, 100)), true);
    assert.equal(isOverBudget(row(100, 100)), false);
    assert.equal(isOverBudget(row(99, 100)), false);
  });

  test('an entry without a budget is never over', () => {
    assert.equal(isOverBudget(row(1_000_000, undefined)), false);
  });
});

describe('forbiddenInputs', () => {
  test('a read-only bundle with admin, connect-admin or effect inputs is reported', () => {
    const inputs = ['src/read-only.ts', 'src/client/scoped/connect-admin.ts', 'src/admin.ts', 'src/effect/services.ts'];
    assert.deepEqual(forbiddenInputs(inputs), [
      'src/client/scoped/connect-admin.ts',
      'src/admin.ts',
      'src/effect/services.ts',
    ]);
  });

  test('the read-only entry closure is clean', () => {
    assert.deepEqual(forbiddenInputs(['src/read-only.ts', 'src/client/scoped/compose.ts', 'src/constants.ts']), []);
  });
});

describe('formatRow', () => {
  test('prints the entry, the bytes, the budget and the status', () => {
    const line = formatRow({ entry: SizeEntry.ReadOnly, bytes: 120, budget: 150, note: undefined });
    assert.match(line, /\/read-only\s+120 B\s+budget 150\s+ok/);
  });

  test('marks an over-budget entry and a provisional note', () => {
    const line = formatRow({ entry: SizeEntry.Effect, bytes: 200, budget: 150, note: 'provisional until P6a re-measures' });
    assert.match(line, /OVER/);
    assert.match(line, /\(provisional until P6a re-measures\)/);
  });
});

describe('SizeBudget', () => {
  test('budgets the core, read-only and effect entries only', () => {
    assert.deepEqual(Object.keys(SizeBudget).sort(), [SizeEntry.Core, SizeEntry.Effect, SizeEntry.ReadOnly].sort());
  });
});
