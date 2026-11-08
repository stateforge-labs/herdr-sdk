// Role: the size gate (`bun run check:size`, which builds dist/ first): measures each compiled entry of dist/ and each consumer scenario, prints them against their budgets,
// and exits 1 when a row is over budget or a production row or scenario contains a forbidden input (plan 10.1 no-leak check). `--measure` prints without enforcing.
// Informs plan 10.1 (size table), HERDR-ADR-0015 (budgets per consumer scenario) and HERDR-ADR-0005 (read-only never pulls admin or effect).
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Measurement, ALWAYS_FORBIDDEN, leakedInputs, leakedText, measureEntry } from './size-measure.ts';
import {
  SizeBudget,
  SizeDistFile,
  SizeFlag,
  SizeForbidden,
  SizeForbiddenReadOnly,
  SizeNote,
  SizePackage,
  SizeRow,
  SizeScenarioFile,
  SizeTemp,
} from './size-constants.ts';

export interface SizeRowResult {
  readonly row: SizeRow;
  readonly bytes: number;
  readonly budget: number | undefined;
  readonly leaks: readonly string[];
}

// Pure: true when a budget exists and the measured size is above it.
export function isOverBudget(bytes: number, budget: number | undefined): boolean {
  return budget !== undefined && bytes > budget;
}

// Pure: the forbidden fragments a row contains: the always-forbidden list, plus the read-only extras when the row is /read-only or a read-only scenario.
export function rowLeaks(measured: Measurement, readOnlyRule: boolean): string[] {
  const extra = readOnlyRule ? Object.values(SizeForbiddenReadOnly) : [];
  const fromInputs = leakedInputs(measured.inputs, [...ALWAYS_FORBIDDEN, ...extra]);
  const fromText = leakedText(measured.emitted, [SizeForbidden.ChildProcess]);
  return [...fromInputs, ...fromText];
}

// Pure: one printed line per row.
export function formatRow(result: SizeRowResult): string {
  const budget = result.budget === undefined ? SizeNote.NoBudget : `budget ${result.budget}`;
  const status = result.leaks.length > 0 ? SizeNote.Leak : isOverBudget(result.bytes, result.budget) ? SizeNote.Over : SizeNote.Ok;
  const leaks = result.leaks.length === 0 ? '' : `  forbidden: ${result.leaks.join(', ')}`;
  return `${result.row.padEnd(22)} ${String(result.bytes).padStart(8)} B  ${budget.padEnd(16)} ${status}${leaks}`;
}

// Pure: true when a row fails the gate: over budget, or it contains a forbidden input.
export function rowFails(result: SizeRowResult): boolean {
  return isOverBudget(result.bytes, result.budget) || result.leaks.length > 0;
}

const PACKAGE_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

function resultOf(row: SizeRow, measured: Measurement, readOnlyRule: boolean): SizeRowResult {
  return { row, bytes: measured.bytes, budget: SizeBudget[row], leaks: rowLeaks(measured, readOnlyRule) };
}

// A scenario is copied next to a node_modules symlink to the package, so `@stateforge-labs/herdr/...` resolves through the package exports, as for a consumer.
function measureScenario(source: string): Measurement {
  const dir = mkdtempSync(join(tmpdir(), SizeTemp.DirPrefix));
  try {
    const scope = join(dir, SizePackage.NodeModules, SizePackage.Scope);
    mkdirSync(scope, { recursive: true });
    symlinkSync(PACKAGE_ROOT, join(scope, SizePackage.PackageDir), 'dir');
    const entry = join(dir, SizePackage.Scenario);
    copyFileSync(join(PACKAGE_ROOT, source), entry);
    return measureEntry(entry, process.execPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function requireDist(): void {
  if (!existsSync(join(PACKAGE_ROOT, SizeDistFile.Core))) {
    throw new Error(`${SizeDistFile.Core} is missing: run \`bun run build\` (or \`bun run check:size\`) first`);
  }
}

export function run(measureOnly: boolean): number {
  requireDist();
  const results: SizeRowResult[] = [];
  const core = measureEntry(join(PACKAGE_ROOT, SizeDistFile.Core), process.execPath);
  results.push(resultOf(SizeRow.Core, core, false));
  results.push(resultOf(SizeRow.ReadOnly, measureEntry(join(PACKAGE_ROOT, SizeDistFile.ReadOnly), process.execPath), true));
  results.push(resultOf(SizeRow.Admin, measureEntry(join(PACKAGE_ROOT, SizeDistFile.Admin), process.execPath), false));
  results.push(resultOf(SizeRow.Effect, measureEntry(join(PACKAGE_ROOT, SizeDistFile.Effect), process.execPath), false));
  // The schema entry carries the method table and parameter shapes by design, so only the child_process text check applies to it.
  const schema = measureEntry(join(PACKAGE_ROOT, SizeDistFile.Schema), process.execPath);
  results.push({ row: SizeRow.Schema, bytes: schema.bytes, budget: SizeBudget[SizeRow.Schema], leaks: leakedText(schema.emitted, [SizeForbidden.ChildProcess]) });
  results.push({ row: SizeRow.Lazy, bytes: core.lazyBytes, budget: SizeBudget[SizeRow.Lazy], leaks: [] });
  results.push(resultOf(SizeRow.ScenarioA, measureScenario(SizeScenarioFile.A), true));
  results.push(resultOf(SizeRow.ScenarioAPreset, measureScenario(SizeScenarioFile.APreset), true));
  results.push(resultOf(SizeRow.ScenarioB, measureScenario(SizeScenarioFile.B), false));
  results.push(resultOf(SizeRow.ScenarioC, measureScenario(SizeScenarioFile.C), false));
  for (const result of results) {
    console.log(formatRow(result));
  }
  const failed = results.some(rowFails);
  return failed && !measureOnly ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = run(process.argv.includes(SizeFlag.Measure));
}
