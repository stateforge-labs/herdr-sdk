// Role: the only I/O of herdr-drift: reads the committed schema, runs the installed herdr CLI, prints the outcome and sets the exit code.
// Informs HERDR-ADR-0009 (drift CLI, exit 0/1/2/3, run in the owner's gate) and HERDR-ADR-0008 (the herdr CLI runs here only; never the socket).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DriftExitCode, DriftOutcomeKind } from '../src/constants.ts';
import { ArgsKind, DEFAULT_HERDR_BIN, HerdrCall } from '../src/drift/constants.ts';
import type { RunArgs } from '../src/drift/args.ts';
import { HELP_TEXT } from '../src/drift/help-text.ts';
import { parseArgs } from '../src/drift/args.ts';
import { exitCodeFor } from '../src/drift/exit-code.ts';
import { outcomeOf, outcomeOrNotCovered } from '../src/drift/outcome.ts';
import { renderJson, renderOutcome } from '../src/drift/render.ts';
import { committedSource, installedSource, type RunHerdr } from '../src/drift/schema-source.ts';
import type { DriftOutcome } from '../src/drift/types.ts';

const DEFAULT_SCHEMA_DIR = fileURLToPath(new URL('../schema', import.meta.url));

function runHerdrCli(binary: string): RunHerdr {
  return (args) => execFileSync(binary, [...args], {
    encoding: 'utf8',
    timeout: HerdrCall.TimeoutMs,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function emit(outcome: DriftOutcome, json: boolean): DriftExitCode {
  const code = exitCodeFor(outcome);
  const text = json ? renderJson(outcome) : renderOutcome(outcome).join('\n');
  const stream = code >= DriftExitCode.Usage ? process.stderr : process.stdout;
  stream.write(`${text}\n`);
  return code;
}

// Reads both schemas and compares them. Any error thrown here is caught by main and reported as NOT COVERED.
async function lookAt(parsed: RunArgs): Promise<DriftOutcome> {
  const readText = (path: string) => readFileSync(path, 'utf8');
  const committed = await committedSource(parsed.committed ?? DEFAULT_SCHEMA_DIR, readText)();
  const installed = await installedSource(runHerdrCli(parsed.herdr ?? DEFAULT_HERDR_BIN))();
  return outcomeOf(committed, installed);
}

async function main(): Promise<DriftExitCode> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.kind === ArgsKind.Help) {
    process.stdout.write(`${HELP_TEXT}\n`);
    return DriftExitCode.Clean;
  }
  if (parsed.kind === ArgsKind.Usage) {
    return emit({ kind: DriftOutcomeKind.Usage, message: parsed.message }, false);
  }
  return emit(await outcomeOrNotCovered(() => lookAt(parsed)), parsed.json);
}

process.exitCode = await main();
