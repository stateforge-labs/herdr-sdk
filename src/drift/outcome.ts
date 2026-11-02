// Role: outcomeOf(): turns the committed and the installed read into one drift outcome; outcomeOrNotCovered(): turns any unexpected error while looking into NOT COVERED.
// Informs HERDR-ADR-0009 ("could not look" is exit 3, never 0: a gate that did not run is not green; a crash must not read as drift).
import { DriftOutcomeKind, SchemaReadKind } from '../constants.ts';
import { driftBetween } from './drift-between.ts';
import { MalformedSchemaError } from './malformed-schema-error.ts';
import type { DriftOutcome, SchemaRead } from './types.ts';

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
