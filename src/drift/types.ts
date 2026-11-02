// Role: CONTRACT of schema drift: the inventory of a schema, the drift report between the committed and the installed schema, the schema source and the exit-code rule.
// Informs HERDR-ADR-0017 (locked seam; read-only for every lane), HERDR-ADR-0009 (drift, exit 0/1/2/3, P5 could not look = 3) and plan 6. Pure: no I/O in src/drift.
import type { DriftExitCode, DriftOutcomeKind, SchemaReadKind } from '../constants.ts';

/** A schema as JSON (the committed schema/herdr-api.schema.json or `herdr api schema --json`). Never read from the socket (W4). */
export type SchemaDocument = Readonly<Record<string, unknown>>;

/** Everything drift compares, extracted from one schema plus its herdr version. */
export interface SchemaInventory {
  readonly protocol: number;
  readonly herdrVersion: string;
  readonly methods: readonly string[];
  readonly resultTags: readonly string[];
  readonly eventKinds: readonly string[];
  readonly subscriptionTypes: readonly string[];
  /** Field shape per params/result type, as a stable string (for "changed" detection). */
  readonly fieldShapes: Readonly<Record<string, string>>;
}

/** Added and removed are listed separately (HERDR-ADR-0009). */
export interface NameDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

export interface DriftReport {
  readonly protocol: { readonly committed: number; readonly installed: number };
  readonly herdrVersion: { readonly committed: string; readonly installed: string };
  readonly methods: NameDiff;
  readonly resultTags: NameDiff;
  readonly eventKinds: NameDiff;
  readonly subscriptionTypes: NameDiff;
  /** Type names whose field shape differs. */
  readonly changedShapes: readonly string[];
  /** Installed methods without a METHOD_RESULT row (plan 4.2). */
  readonly unmappedMethods: readonly string[];
  /** True when anything above differs. */
  readonly drifted: boolean;
}

/** Builds the inventory of one schema. Implemented by drift/inventory.ts (P5c). */
export type InventoryOf = (schema: SchemaDocument, herdrVersion: string) => SchemaInventory;

/** Compares two schemas. Pure. Implemented by drift/drift-between.ts (P5c). */
export type DriftBetween = (
  committed: { readonly schema: SchemaDocument; readonly herdrVersion: string },
  installed: { readonly schema: SchemaDocument; readonly herdrVersion: string },
) => DriftReport;

/** What a schema source found. NotFound / Unreadable lead to exit 3 (could not look). */
export type SchemaRead =
  | { readonly kind: typeof SchemaReadKind.Found; readonly schema: SchemaDocument; readonly herdrVersion: string }
  | { readonly kind: typeof SchemaReadKind.NotFound; readonly reason: string }
  | { readonly kind: typeof SchemaReadKind.Unreadable; readonly reason: string };

/** Reads one schema. bin/herdr-drift.ts injects the file reader and the `herdr` CLI runner (P5c); src/drift never does I/O. */
export type SchemaSource = () => Promise<SchemaRead>;

/** The CLI outcome before exit codes: a usage error, a source that could not look, or a report. */
export type DriftOutcome =
  | { readonly kind: typeof DriftOutcomeKind.Usage; readonly message: string }
  | { readonly kind: typeof DriftOutcomeKind.NotCovered; readonly reason: string }
  | { readonly kind: typeof DriftOutcomeKind.Report; readonly report: DriftReport };

/** 0 clean, 1 drift, 2 usage, 3 could not look (never 0). Implemented by drift/exit-code.ts (P5c). */
export type ExitCodeFor = (outcome: DriftOutcome) => DriftExitCode;
