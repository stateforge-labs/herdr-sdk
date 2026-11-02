// Role: generator entry, `bun gen/index.ts`; writes the src/generated/ modules and the docs/api/ references.
// Informs HERDR-ADR-0002 and plan section 3.2. Output must be reproducible (git diff clean after a rerun).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertClassified } from './capabilities.ts';
import { emitDefaults } from './emit-defaults.ts';
import { emitEventsDoc, emitMethodsDoc } from './emit-docs.ts';
import { emitErrors } from './emit-errors.ts';
import { emitEvents } from './emit-events.ts';
import { emitIndex } from './emit-index.ts';
import { emitMethodTable, methodNames } from './emit-method-table.ts';
import { emitNames } from './emit-names.ts';
import { emitNamespaces } from './emit-namespaces.ts';
import { emitOverrides } from './emit-overrides.ts';
import { emitParams } from './emit-params.ts';
import { emitResults } from './emit-results.ts';
import { emitShapes } from './emit-shapes.ts';
import { assertOverrides } from './overrides.ts';
import type { ApiSchema } from './schema.ts';
import { GEN_PATHS, header, loadSchema } from './schema.ts';

// File names written into the output directory.
export const OUTPUT_FILES = {
  methods: 'methods.ts',
  params: 'params.ts',
  results: 'results.ts',
  errors: 'errors.ts',
  events: 'events.ts',
  names: 'names.ts',
  namespaces: 'namespaces.ts',
  defaults: 'defaults.ts',
  shapes: 'shapes.ts',
  overrides: 'overrides.ts',
  index: 'index.ts',
} as const;

// File names written into the docs directory.
export const DOC_FILES = {
  methods: 'methods.md',
  events: 'events.md',
} as const;

type OutputKey = keyof typeof OUTPUT_FILES;
type DocKey = keyof typeof DOC_FILES;

// Printed after a CLI run; mirrors GEN_PATHS relative to the package.
const DISPLAY_OUT_DIR = 'src/generated/';
const DISPLAY_DOCS_DIR = 'docs/api/';

export interface GenOptions {
  readonly schemaPath: string;
  readonly outDir: string;
  readonly docsDir: string;
}

// Refuses a schema whose methods, classes or overrides do not agree before any file is rendered.
function assertCoverage(schema: ApiSchema): void {
  const methods = methodNames(schema);
  assertClassified(methods);
  assertOverrides(schema, methods);
}

// The body of every output module, keyed like OUTPUT_FILES.
export function renderOutputs(schema: ApiSchema): Readonly<Record<OutputKey, string>> {
  assertCoverage(schema);
  const banner = header(schema);
  return {
    methods: emitMethodTable(schema, banner),
    params: emitParams(schema, banner),
    results: emitResults(schema, banner),
    errors: emitErrors(schema, banner),
    events: emitEvents(schema, banner),
    names: emitNames(schema, banner),
    namespaces: emitNamespaces(schema, banner),
    defaults: emitDefaults(schema, banner),
    shapes: emitShapes(schema, banner),
    overrides: emitOverrides(banner),
    index: emitIndex(schema, banner),
  };
}

// The body of every docs file, keyed like DOC_FILES.
export function renderDocs(schema: ApiSchema): Readonly<Record<DocKey, string>> {
  assertCoverage(schema);
  return { methods: emitMethodsDoc(schema), events: emitEventsDoc(schema) };
}

export function runGenerator({ schemaPath, outDir, docsDir }: GenOptions): void {
  const schema = loadSchema(schemaPath);
  const outputs = renderOutputs(schema);
  const docs = renderDocs(schema);
  mkdirSync(outDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });
  for (const key of Object.keys(OUTPUT_FILES) as OutputKey[]) {
    writeFileSync(join(outDir, OUTPUT_FILES[key]), outputs[key]);
  }
  for (const key of Object.keys(DOC_FILES) as DocKey[]) {
    writeFileSync(join(docsDir, DOC_FILES[key]), docs[key]);
  }
}

if (import.meta.main) {
  runGenerator(GEN_PATHS);
  const outputCount = Object.keys(OUTPUT_FILES).length;
  const docCount = Object.keys(DOC_FILES).length;
  process.stdout.write(`generated ${outputCount} files -> ${DISPLAY_OUT_DIR}, ${docCount} docs -> ${DISPLAY_DOCS_DIR}\n`);
}
