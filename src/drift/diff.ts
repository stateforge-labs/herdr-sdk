// Role: comparing two inventories: the name diff, the drift report, its outcome and exit code.
// Informs HERDR-ADR-0009, plan 6; merged by HERDR-ADR-0021 from name-diff.ts, drift-between.ts, outcome.ts, exit-code.ts.
import type { NameDiff, DriftBetween, SchemaInventory, DriftOutcome, SchemaRead, ExitCodeFor } from './types.ts';
import { inventoryOf, unmappedMethods } from './schema.ts';
import { DriftOutcomeKind, SchemaReadKind, DriftExitCode } from '../constants.ts';
import { MalformedSchemaError } from '../herdr/errors.ts';

export function nameDiff(committed: readonly string[], installed: readonly string[]): NameDiff {
  return {
    added: missingFrom(installed, committed),
    removed: missingFrom(committed, installed),
  };
}

export function hasMovement(diff: NameDiff): boolean {
  return diff.added.length > 0 || diff.removed.length > 0;
}

function missingFrom(names: readonly string[], others: readonly string[]): string[] {
  const known = new Set(others);
  return names.filter((name) => !known.has(name)).toSorted();
}

export const driftBetween: DriftBetween = (committed, installed) => {
  const copy = inventoryOf(committed.schema, committed.herdrVersion);
  const live = inventoryOf(installed.schema, installed.herdrVersion);
  const methods = nameDiff(copy.methods, live.methods);
  const resultTags = nameDiff(copy.resultTags, live.resultTags);
  const eventKinds = nameDiff(copy.eventKinds, live.eventKinds);
  const subscriptionTypes = nameDiff(copy.subscriptionTypes, live.subscriptionTypes);
  const changedShapes = changedShapesOf(copy, live);
  const unmapped = unmappedMethods(live.methods);
  const drifted = copy.protocol !== live.protocol
    || copy.herdrVersion !== live.herdrVersion
    || [methods, resultTags, eventKinds, subscriptionTypes].some(hasMovement)
    || changedShapes.length > 0
    || unmapped.length > 0;
  return {
    protocol: { committed: copy.protocol, installed: live.protocol },
    herdrVersion: { committed: copy.herdrVersion, installed: live.herdrVersion },
    methods,
    resultTags,
    eventKinds,
    subscriptionTypes,
    changedShapes,
    unmappedMethods: unmapped,
    drifted,
  };
};

// Types present on both sides whose stable field shape differs (added and removed types are reported by the facets).
function changedShapesOf(copy: SchemaInventory, live: SchemaInventory): string[] {
  return Object.keys(copy.fieldShapes)
    .filter((name) => Object.hasOwn(live.fieldShapes, name) && copy.fieldShapes[name] !== live.fieldShapes[name])
    .toSorted();
}

type FoundRead = Extract<SchemaRead, { readonly kind: typeof SchemaReadKind.Found }>;

export function outcomeOf(committed: SchemaRead, installed: SchemaRead): DriftOutcome {
  if (committed.kind !== SchemaReadKind.Found) {
    return notCovered(committed.reason);
  }
  if (installed.kind !== SchemaReadKind.Found) {
    return notCovered(installed.reason);
  }
  return reportOf(committed, installed);
}

// Runs the look; any error it throws, expected or not, is NOT COVERED with its message.
export async function outcomeOrNotCovered(look: () => Promise<DriftOutcome>): Promise<DriftOutcome> {
  try {
    return await look();
  } catch (error) {
    return notCovered(error instanceof Error ? error.message : String(error));
  }
}

function reportOf(committed: FoundRead, installed: FoundRead): DriftOutcome {
  try {
    return { kind: DriftOutcomeKind.Report, report: driftBetween(committed, installed) };
  } catch (error) {
    // A schema without a required definition or tag cannot be compared, so it counts as not looked at.
    if (error instanceof MalformedSchemaError) {
      return notCovered(error.message);
    }
    throw error;
  }
}

function notCovered(reason: string): DriftOutcome {
  return { kind: DriftOutcomeKind.NotCovered, reason };
}

export const exitCodeFor: ExitCodeFor = (outcome) => {
  switch (outcome.kind) {
    case DriftOutcomeKind.Usage:
      return DriftExitCode.Usage;
    case DriftOutcomeKind.NotCovered:
      return DriftExitCode.NotCovered;
    case DriftOutcomeKind.Report:
      return outcome.report.drifted ? DriftExitCode.Drift : DriftExitCode.Clean;
  }
};
