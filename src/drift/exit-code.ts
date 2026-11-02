// Role: exitCodeFor(): maps a drift outcome to the CLI exit code: 0 clean, 1 drift, 2 usage, 3 could not look (never 0 for those).
// Informs HERDR-ADR-0009 (exit codes; a gate that did not run is not green); contract in drift/types.ts (ExitCodeFor).
import { DriftExitCode, DriftOutcomeKind } from '../constants.ts';
import type { ExitCodeFor } from './types.ts';

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
