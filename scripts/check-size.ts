// Role: the size gate (`bun scripts/check-size.ts`): bundles each library entry minified with effect external, prints the sizes against
// their budgets, and exits 1 when one is over budget or /read-only bundles an admin or effect input. `--measure` prints without enforcing.
// Informs plan 10.1 (size table; budgets set in phase 2b), HERDR-ADR-0015 (size budget) and HERDR-ADR-0005 (read-only never pulls admin).
// Build flags: `--target=node` (SizeBuildArg.Target) is a deliberate deviation from the bare `bun build --minify --external effect <entry>`
// of plan 10.1. The bare command targets the browser and cannot resolve node:net, so it fails on this package. The study baseline
// (docs/research/studies/2026-11-02-herdr-size-baseline) also measures with --target node, so the budgets compare like with like.
// Integration should update the plan 10.1 command to `bun build --minify --target node --external effect <entry>`.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SizeBudget,
  SizeBuildArg,
  SizeEntry,
  SizeForbiddenInput,
  SizeNote,
  SizeSource,
} from '../src/constants.ts';

export interface SizeRow {
  readonly entry: string;
  readonly bytes: number;
  readonly budget: number | undefined;
  readonly note: string | undefined;
}

export const MEASURE_FLAG = '--measure';

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const METAFILE_NAME = 'meta.json';
const BUILD_DIR_PREFIX = 'herdr-size-';
const MAX_BUNDLE_BYTES = 64 * 1024 * 1024;
const PROVISIONAL: readonly string[] = [SizeEntry.Effect];

// Pure: true when a budget exists and the measured size is above it.
export function isOverBudget(row: SizeRow): boolean {
  return row.budget !== undefined && row.bytes > row.budget;
}

// Pure: the inputs of a bundle that /read-only must not have.
export function forbiddenInputs(inputs: readonly string[]): string[] {
  const forbidden = [SizeForbiddenInput.Admin, SizeForbiddenInput.ConnectAdmin, SizeForbiddenInput.EffectPrefix];
  return inputs.filter((input) => forbidden.some((pattern) => input.includes(pattern)));
}

// Pure: one printed line per entry.
export function formatRow(row: SizeRow): string {
  const budget = row.budget === undefined ? 'not budgeted' : `budget ${row.budget}`;
  const status = isOverBudget(row) ? 'OVER' : 'ok';
  const note = row.note === undefined ? '' : `  (${row.note})`;
  return `${row.entry.padEnd(14)} ${String(row.bytes).padStart(8)} B  ${budget.padEnd(16)} ${status}${note}`;
}

function bundle(source: string): { bytes: number; inputs: string[] } {
  const dir = mkdtempSync(join(tmpdir(), BUILD_DIR_PREFIX));
  try {
    const metafile = join(dir, METAFILE_NAME);
    const output = execFileSync(
      process.execPath,
      [
        SizeBuildArg.Build,
        SizeBuildArg.Target,
        SizeBuildArg.Minify,
        SizeBuildArg.External,
        SizeBuildArg.Effect,
        source,
        `${SizeBuildArg.Metafile}${metafile}`,
      ],
      { cwd: PACKAGE_ROOT, maxBuffer: MAX_BUNDLE_BYTES },
    );
    const meta = JSON.parse(readFileSync(metafile, 'utf8')) as { inputs: Record<string, unknown> };
    return { bytes: output.byteLength, inputs: Object.keys(meta.inputs) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const MEASURED: readonly { readonly entry: string; readonly source: string }[] = [
  { entry: SizeEntry.Core, source: SizeSource.Core },
  { entry: SizeEntry.ReadOnly, source: SizeSource.ReadOnly },
  { entry: SizeEntry.Effect, source: SizeSource.Effect },
  { entry: SizeEntry.Admin, source: SizeSource.Admin },
  { entry: SizeEntry.TestKit, source: SizeSource.TestKit },
  { entry: SizeEntry.Mcp, source: SizeSource.Mcp },
];

function run(measureOnly: boolean): number {
  let failed = false;
  for (const { entry, source } of MEASURED) {
    const built = bundle(join(PACKAGE_ROOT, source));
    const row: SizeRow = {
      entry,
      bytes: built.bytes,
      budget: SizeBudget[entry],
      note: PROVISIONAL.includes(entry) ? SizeNote.Provisional : undefined,
    };
    console.log(formatRow(row));
    if (entry === SizeEntry.ReadOnly) {
      const leaked = forbiddenInputs(built.inputs);
      if (leaked.length > 0) {
        console.log(`  /read-only bundles forbidden inputs: ${leaked.join(', ')}`);
        failed = true;
      }
    }
    if (!measureOnly && isOverBudget(row)) {
      failed = true;
    }
  }
  return failed && !measureOnly ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = run(process.argv.includes(MEASURE_FLAG));
}
