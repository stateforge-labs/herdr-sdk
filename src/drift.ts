// Role: the /drift entry (the bin runs drift/cli.ts): pure inventory, drift report and exit-code rule.
// Informs HERDR-ADR-0003 (one file per subpath export), HERDR-ADR-0009 and HERDR-ADR-0017; edited only by the integration step.
export { driftBetween } from './drift/diff.ts';
export { exitCodeFor } from './drift/diff.ts';
export { inventoryOf } from './drift/schema.ts';
export { DriftExitCode, DriftOutcomeKind } from './constants.ts';
export type * from './drift/types.ts';
