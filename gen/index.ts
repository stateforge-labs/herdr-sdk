// Role: generator entry, `bun gen/index.ts`; writes the committed output into src/generated/.
// Informs HERDR-ADR-0002 and plan section 3.2. Output must be reproducible (git diff clean after a rerun).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { emitMethodTable } from './emit-method-table.ts';
import { GEN_PATHS, header, loadSchema } from './schema.ts';

// File names written into the output directory.
export const OUTPUT_FILES = { methods: 'methods.ts' } as const;

// Printed after a CLI run; mirrors GEN_PATHS.outDir relative to the package.
const DISPLAY_OUT_DIR = 'src/generated/';

export interface GenOptions {
  readonly schemaPath: string;
  readonly outDir: string;
}

export function runGenerator({ schemaPath, outDir }: GenOptions): void {
  const schema = loadSchema(schemaPath);
  const body = emitMethodTable(schema, header(schema));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, OUTPUT_FILES.methods), body);
}

if (import.meta.main) {
  runGenerator(GEN_PATHS);
  process.stdout.write(`generated 1 file -> ${DISPLAY_OUT_DIR}\n`);
}
