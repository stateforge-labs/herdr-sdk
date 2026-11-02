// Role: generator entry, `bun gen/index.ts`; writes the six committed modules into src/generated/.
// Informs HERDR-ADR-0002 and plan section 3.2. Output must be reproducible (git diff clean after a rerun).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { emitErrors } from './emit-errors.ts';
import { emitEvents } from './emit-events.ts';
import { emitIndex } from './emit-index.ts';
import { emitMethodTable } from './emit-method-table.ts';
import { emitParams } from './emit-params.ts';
import { emitResults } from './emit-results.ts';
import type { ApiSchema } from './schema.ts';
import { GEN_PATHS, header, loadSchema } from './schema.ts';

// File names written into the output directory.
export const OUTPUT_FILES = {
  methods: 'methods.ts',
  params: 'params.ts',
  results: 'results.ts',
  errors: 'errors.ts',
  events: 'events.ts',
  index: 'index.ts',
} as const;

type OutputKey = keyof typeof OUTPUT_FILES;

// Printed after a CLI run; mirrors GEN_PATHS.outDir relative to the package.
const DISPLAY_OUT_DIR = 'src/generated/';

export interface GenOptions {
  readonly schemaPath: string;
  readonly outDir: string;
}

// The body of every output module, keyed like OUTPUT_FILES.
export function renderOutputs(schema: ApiSchema): Readonly<Record<OutputKey, string>> {
  const banner = header(schema);
  return {
    methods: emitMethodTable(schema, banner),
    params: emitParams(schema, banner),
    results: emitResults(schema, banner),
    errors: emitErrors(schema, banner),
    events: emitEvents(schema, banner),
    index: emitIndex(schema, banner),
  };
}

export function runGenerator({ schemaPath, outDir }: GenOptions): void {
  const outputs = renderOutputs(loadSchema(schemaPath));
  mkdirSync(outDir, { recursive: true });
  for (const key of Object.keys(OUTPUT_FILES) as OutputKey[]) {
    writeFileSync(join(outDir, OUTPUT_FILES[key]), outputs[key]);
  }
}

if (import.meta.main) {
  runGenerator(GEN_PATHS);
  process.stdout.write(`generated ${Object.keys(OUTPUT_FILES).length} files -> ${DISPLAY_OUT_DIR}\n`);
}
