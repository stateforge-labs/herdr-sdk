// Role: the herdr-drift command: arguments, help, rendering and the run.
// Informs HERDR-ADR-0009, HERDR-ADR-0008; merged by HERDR-ADR-0021 from help-text.ts, args.ts, render.ts, cli.ts.
import { DriftExitCode, DriftOutcomeKind } from '../constants.ts';
import { DriftName, ArgFlag, ArgsKind, UsageText, DriftFacet, DEFAULT_HERDR_BIN } from './constants.ts';
import { hasMovement, exitCodeFor, outcomeOf, outcomeOrNotCovered } from './diff.ts';
import type { DriftOutcome, DriftReport, NameDiff } from './types.ts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { committedSource, installedSource } from './schema.ts';
import type { RunHerdr } from './schema.ts';

export const HELP_TEXT = `${DriftName} [--committed <dir>] [--herdr <bin>] [--json] [--help]

  Answers ONE question: does the schema committed in schema/ still match the
  schema the installed herdr publishes?

  It compares the protocol number, the herdr version and four facets by name:
  methods, result tags, event kinds and subscribable types. It also reports
  changed field shapes and methods without a METHOD_RESULT row. A facet that
  moved is named with what was added and what was removed.

  --committed <dir>  directory holding herdr-api.schema.json and herdr-version.json
  --herdr <bin>      the herdr binary to ask (default: herdr on PATH)
  --json             print the report as JSON

  Exits: ${DriftExitCode.Clean} the copy matches · ${DriftExitCode.Drift} it drifted · ${DriftExitCode.Usage} misuse · ${DriftExitCode.NotCovered} NOT COVERED`;

export interface RunArgs {
  readonly kind: typeof ArgsKind.Run;
  // Null means the default (the package schema/ directory); the bin resolves it.
  readonly committed: string | null;
  // Null means the default `herdr` on PATH; the bin resolves it.
  readonly herdr: string | null;
  readonly json: boolean;
}

export type ParsedArgs =
  | RunArgs
  | { readonly kind: typeof ArgsKind.Help }
  | { readonly kind: typeof ArgsKind.Usage; readonly message: string };

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const run = { committed: null as string | null, herdr: null as string | null, json: false };
  let index = 0;
  while (index < argv.length) {
    const flag = argv[index] ?? '';
    if (flag === ArgFlag.Help) {
      return { kind: ArgsKind.Help };
    }
    if (flag === ArgFlag.Json) {
      run.json = true;
      index += 1;
      continue;
    }
    if (flag === ArgFlag.Committed || flag === ArgFlag.Herdr) {
      const value = argv[index + 1];
      if (value === undefined) {
        return usage(UsageText.MissingValue(flag));
      }
      if (flag === ArgFlag.Committed) {
        run.committed = value;
      } else {
        run.herdr = value;
      }
      index += 2;
      continue;
    }
    return usage(UsageText.Unexpected(flag));
  }
  return { kind: ArgsKind.Run, ...run };
}

function usage(message: string): ParsedArgs {
  return { kind: ArgsKind.Usage, message };
}

export function renderOutcome(outcome: DriftOutcome): string[] {
  switch (outcome.kind) {
    case DriftOutcomeKind.Usage:
      return [statusLine(DriftExitCode.Usage, `USAGE: ${outcome.message}`)];
    case DriftOutcomeKind.NotCovered:
      return [statusLine(DriftExitCode.NotCovered, `NOT COVERED: ${outcome.reason}`)];
    case DriftOutcomeKind.Report:
      return reportLines(outcome.report);
  }
}

export function renderJson(outcome: DriftOutcome): string {
  return JSON.stringify(outcome.kind === DriftOutcomeKind.Report ? outcome.report : outcome, null, 2);
}

function reportLines(report: DriftReport): string[] {
  const findings = findingsOf(report);
  if (findings.length === 0) {
    return [statusLine(DriftExitCode.Clean, `clean (protocol ${report.protocol.installed}, herdr ${report.herdrVersion.installed})`)];
  }
  return [...findings, statusLine(DriftExitCode.Drift, `${findings.length} finding(s)`)];
}

function findingsOf(report: DriftReport): string[] {
  const findings: string[] = [];
  if (report.protocol.committed !== report.protocol.installed) {
    findings.push(`protocol moved ${report.protocol.committed} -> ${report.protocol.installed}`);
  }
  if (report.herdrVersion.committed !== report.herdrVersion.installed) {
    findings.push(`herdr version moved ${report.herdrVersion.committed} -> ${report.herdrVersion.installed}`);
  }
  const facets: readonly (readonly [string, NameDiff])[] = [
    [DriftFacet.Methods, report.methods],
    [DriftFacet.ResultTags, report.resultTags],
    [DriftFacet.EventKinds, report.eventKinds],
    [DriftFacet.SubscriptionTypes, report.subscriptionTypes],
  ];
  for (const [label, diff] of facets) {
    if (hasMovement(diff)) {
      findings.push(facetLine(label, diff));
    }
  }
  if (report.changedShapes.length > 0) {
    findings.push(`field shapes changed: ${report.changedShapes.join(', ')}`);
  }
  if (report.unmappedMethods.length > 0) {
    findings.push(`methods without a METHOD_RESULT row: ${report.unmappedMethods.join(', ')}`);
  }
  return findings;
}

function facetLine(label: string, diff: NameDiff): string {
  const parts: string[] = [];
  if (diff.added.length > 0) {
    parts.push(`herdr ADDED ${diff.added.length} the copy lacks: ${diff.added.join(', ')}`);
  }
  if (diff.removed.length > 0) {
    parts.push(`herdr REMOVED ${diff.removed.length} the copy still has: ${diff.removed.join(', ')}`);
  }
  return `${label}: ${parts.join(' · ')}`;
}

function statusLine(code: DriftExitCode, text: string): string {
  return `${DriftName}: ${code} — ${text}`;
}

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
