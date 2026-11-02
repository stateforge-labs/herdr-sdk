// Role: the only I/O of herdr-drift: reads the committed schema, runs the installed herdr CLI, prints the outcome and returns the exit code. bin/herdr-drift.js calls runDriftCli.
// Informs HERDR-ADR-0009 (drift CLI, exit 0/1/2/3, run in the owner's gate) and HERDR-ADR-0008 (the herdr CLI runs here only; never the socket).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DriftExitCode, DriftOutcomeKind } from '../constants.ts';
import { ArgsKind, DEFAULT_HERDR_BIN } from './constants.ts';
import { parseArgs, type RunArgs } from './args.ts';
import { HELP_TEXT } from './help-text.ts';
import { exitCodeFor } from './exit-code.ts';
import { outcomeOf, outcomeOrNotCovered } from './outcome.ts';
import { renderJson, renderOutcome } from './render.ts';
import { committedSource, installedSource, type RunHerdr } from './schema-source.ts';
import type { DriftOutcome } from './types.ts';

// The committed schema directory of the package (src/drift and dist/drift are both two levels below the package root).
const DEFAULT_SCHEMA_DIR = fileURLToPath(new URL('../../schema', import.meta.url));

// Starts the herdr CLI of a binary path; the bin supplies it (process spawning stays out of the library source).
export type SpawnHerdr = (binary: string) => RunHerdr;

function emit(outcome: DriftOutcome, json: boolean): DriftExitCode {
  const code = exitCodeFor(outcome);
  const text = json ? renderJson(outcome) : renderOutcome(outcome).join('\n');
  const stream = code >= DriftExitCode.Usage ? process.stderr : process.stdout;
  stream.write(`${text}\n`);
  return code;
}

// Reads both schemas and compares them. Any error thrown here is caught by runDriftCli and reported as NOT COVERED.
async function lookAt(parsed: RunArgs, spawnHerdr: SpawnHerdr): Promise<DriftOutcome> {
  const readText = (path: string) => readFileSync(path, 'utf8');
  const committed = await committedSource(parsed.committed ?? DEFAULT_SCHEMA_DIR, readText)();
  const installed = await installedSource(spawnHerdr(parsed.herdr ?? DEFAULT_HERDR_BIN))();
  return outcomeOf(committed, installed);
}

// Runs the CLI for the given arguments (without the node or bun and script entries) and returns the exit code the process should use.
// `spawnHerdr` runs the herdr CLI; bin/herdr-drift.js passes the real one.
export async function runDriftCli(argv: readonly string[], spawnHerdr: SpawnHerdr): Promise<DriftExitCode> {
  const parsed = parseArgs(argv);
  if (parsed.kind === ArgsKind.Help) {
    process.stdout.write(`${HELP_TEXT}\n`);
    return DriftExitCode.Clean;
  }
  if (parsed.kind === ArgsKind.Usage) {
    return emit({ kind: DriftOutcomeKind.Usage, message: parsed.message }, false);
  }
  return emit(await outcomeOrNotCovered(() => lookAt(parsed, spawnHerdr)), parsed.json);
}
