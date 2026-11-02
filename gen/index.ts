// Role: generator entry, `bun gen/index.ts`; writes the src/generated/ modules (nested per kind) and the docs/api/ references.
// Informs HERDR-ADR-0002 and plan section 3.2. Output must be reproducible (git diff clean after a rerun).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { assertClassified } from './capabilities.ts';
import { checkResultMap } from './check-result-map.ts';
import { emitDefaults } from './emit-defaults.ts';
import { emitEventsDoc, emitMethodsDoc } from './emit-docs.ts';
import { emitErrors } from './emit-errors.ts';
import { emitEntryFiles, emitEntryMethods, emitPresetMethods } from './emit-entries.ts';
import { emitEvents } from './emit-events.ts';
import { emitIndex } from './emit-index.ts';
import { emitMethodTable, methodNames } from './emit-method-table.ts';
import { emitNameFiles } from './emit-names.ts';
import { emitNamespaces } from './emit-namespaces.ts';
import { emitOverrides } from './emit-overrides.ts';
import { emitParams } from './emit-params.ts';
import { emitResults } from './emit-results.ts';
import { emitShapes } from './emit-shapes.ts';
import { METHOD_RESULT_MAP } from './method-result-map.ts';
import { assertOverrides } from './overrides.ts';
import type { ApiSchema } from './schema.ts';
import { GEN_PATHS, header, loadSchema } from './schema.ts';

// File names written into the docs directory.
export const DOC_FILES = {
  methods: 'methods.md',
  events: 'events.md',
} as const;

type DocKey = keyof typeof DOC_FILES;

// Printed after a CLI run; mirrors GEN_PATHS relative to the package.
const DISPLAY_OUT_DIR = 'src/generated/';
const DISPLAY_DOCS_DIR = 'docs/api/';

export interface GenOptions {
  readonly schemaPath: string;
  readonly outDir: string;
  readonly docsDir: string;
}

// Refuses a schema whose methods, classes, overrides or result rows do not agree before any file is rendered.
function assertCoverage(schema: ApiSchema): void {
  const methods = methodNames(schema);
  assertClassified(methods);
  assertOverrides(schema, methods);
  const problems = checkResultMap(schema, METHOD_RESULT_MAP);
  if (problems.length > 0) {
    throw new Error(`gen/method-result-map.ts does not cover the schema:\n${problems.join('\n')}`);
  }
}

// The body of every output module, keyed by its path under src/generated/ (nested folders for names/, entries/, presets/, test-data/).
export function renderOutputs(schema: ApiSchema): Readonly<Record<string, string>> {
  assertCoverage(schema);
  const banner = header(schema);
  return {
    ...emitNameFiles(schema, banner),
    ...emitEntryFiles(schema, banner),
    'entry-methods.ts': emitEntryMethods(schema, banner),
    'preset-methods.ts': emitPresetMethods(schema, banner),
    'method-table.ts': emitMethodTable(schema, banner),
    'params.ts': emitParams(schema, banner),
    'results.ts': emitResults(schema, banner),
    'errors.ts': emitErrors(schema, banner),
    'events.ts': emitEvents(schema, banner),
    'namespaces.ts': emitNamespaces(schema, banner),
    'test-data/defaults.ts': emitDefaults(schema, banner),
    'test-data/shapes.ts': emitShapes(schema, banner),
    'overrides.ts': emitOverrides(banner),
    'index.ts': emitIndex(schema, banner),
  };
}

// The body of every docs file, keyed like DOC_FILES.
export function renderDocs(schema: ApiSchema): Readonly<Record<DocKey, string>> {
  assertCoverage(schema);
  return { methods: emitMethodsDoc(schema), events: emitEventsDoc(schema) };
}

// Writes every module from a clean outDir, so a file the generator no longer emits cannot linger.
export function runGenerator({ schemaPath, outDir, docsDir }: GenOptions): void {
  const schema = loadSchema(schemaPath);
  const outputs = renderOutputs(schema);
  const docs = renderDocs(schema);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });
  for (const [path, body] of Object.entries(outputs)) {
    mkdirSync(dirname(join(outDir, path)), { recursive: true });
    writeFileSync(join(outDir, path), body);
  }
  for (const key of Object.keys(DOC_FILES) as DocKey[]) {
    writeFileSync(join(docsDir, DOC_FILES[key]), docs[key]);
  }
}

if (import.meta.main) {
  runGenerator(GEN_PATHS);
  const outputCount = Object.keys(renderOutputs(loadSchema(GEN_PATHS.schemaPath))).length;
  const docCount = Object.keys(DOC_FILES).length;
  process.stdout.write(`generated ${outputCount} files -> ${DISPLAY_OUT_DIR}, ${docCount} docs -> ${DISPLAY_DOCS_DIR}\n`);
}
