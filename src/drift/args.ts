// Role: parseArgs(): reads the herdr-drift flags into a run, a help request or a usage error. Pure.
// Informs HERDR-ADR-0009 (exit 2 is misuse). Flags: --committed <dir>, --herdr <bin>, --json, --help.
import { ArgFlag, ArgsKind, UsageText } from './constants.ts';

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
