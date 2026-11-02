// Role: the help text of herdr-drift (printed by --help).
// Informs HERDR-ADR-0009 (the four exit codes are part of the contract a gate reads).
import { DriftExitCode } from '../constants.ts';
import { DriftName } from './constants.ts';

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
