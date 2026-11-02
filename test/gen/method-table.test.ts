// Role: tests of the METHODS generator (gen/emit-method-table.ts, gen/index.ts) against the committed schema and a fixture.
// Informs HERDR-ADR-0002 and plan section 3.2; the committed output must be reproducible.
import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { METHODS } from '../../src/generated/methods.ts';
import { methodRows, namespaceOf } from '../../gen/emit-method-table.ts';
import { runGenerator, OUTPUT_FILES } from '../../gen/index.ts';
import type { ApiSchema } from '../../gen/schema.ts';
import { branchesOf, constOf, GEN_PATHS, loadSchema, requestNamespace, SCHEMA_KEY } from '../../gen/schema.ts';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(TEST_DIR, 'fixtures', 'methods-mini.schema.json');
const EXPECTED_METHOD_COUNT = 102;
const NAME_SEPARATOR = '.';

const FIXTURE_METHOD = {
  ping: 'ping',
  paneList: 'pane.list',
  paneSelectionRead: 'pane.selection.read',
} as const;

const DUPLICATE_ERROR = 'duplicate method';
const NON_STRING_ERROR = 'expected a string const';

const generatedDirs: string[] = [];

afterAll(() => {
  for (const dir of generatedDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function requestNames(schema: ApiSchema): readonly string[] {
  return branchesOf(requestNamespace(schema)).map((branch) => constOf(branch, SCHEMA_KEY.method));
}

function lastSegment(name: string): string {
  return name.split(NAME_SEPARATOR).at(-1) ?? name;
}

describe('METHODS from the committed schema', () => {
  const committed = loadSchema(GEN_PATHS.schemaPath);

  test('has one row per request branch, all names unique', () => {
    expect(METHODS.length).toBe(EXPECTED_METHOD_COUNT);
    expect(new Set(METHODS.map((row) => row.name)).size).toBe(EXPECTED_METHOD_COUNT);
  });

  test('every row name is a request.oneOf method const', () => {
    const names = new Set(requestNames(committed));
    for (const row of METHODS) {
      expect(names.has(row.name)).toBe(true);
    }
  });

  test('namespace path plus last segment rebuilds the name', () => {
    for (const row of METHODS) {
      expect([...row.ns, lastSegment(row.name)].join(NAME_SEPARATOR)).toBe(row.name);
    }
  });
});

describe('namespace paths', () => {
  test('a single segment has no namespace', () => {
    expect(namespaceOf(FIXTURE_METHOD.ping)).toEqual([]);
  });

  test('one dotted namespace', () => {
    expect(namespaceOf(FIXTURE_METHOD.paneList)).toEqual(['pane']);
  });

  test('nested namespace path', () => {
    expect(namespaceOf(FIXTURE_METHOD.paneSelectionRead)).toEqual(['pane', 'selection']);
  });
});

describe('fixture schema', () => {
  const fixture = loadSchema(FIXTURE_PATH);

  test('emits the three fixture methods with their namespace paths', () => {
    expect(methodRows(fixture)).toEqual([
      { name: FIXTURE_METHOD.ping, ns: [] },
      { name: FIXTURE_METHOD.paneList, ns: ['pane'] },
      { name: FIXTURE_METHOD.paneSelectionRead, ns: ['pane', 'selection'] },
    ]);
  });

  test('a duplicate method const is refused', () => {
    const branches = branchesOf(requestNamespace(fixture));
    const duplicated: ApiSchema = {
      ...fixture,
      schemas: { [SCHEMA_KEY.request]: { oneOf: [...branches, branches[0]!] } },
    };
    expect(() => methodRows(duplicated)).toThrow(DUPLICATE_ERROR);
  });

  test('a non-string method const is refused', () => {
    const branches = branchesOf(requestNamespace(fixture));
    const numeric = {
      properties: { [SCHEMA_KEY.method]: { const: 7 } },
    };
    const broken: ApiSchema = {
      ...fixture,
      schemas: { [SCHEMA_KEY.request]: { oneOf: [...branches, numeric] } },
    };
    expect(() => methodRows(broken)).toThrow(NON_STRING_ERROR);
  });
});

describe('determinism', () => {
  test('a fresh run reproduces the committed src/generated/methods.ts byte for byte', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'herdr-gen-'));
    generatedDirs.push(outDir);
    runGenerator({ schemaPath: GEN_PATHS.schemaPath, outDir });
    const fresh = readFileSync(join(outDir, OUTPUT_FILES.methods), 'utf8');
    const committed = readFileSync(join(GEN_PATHS.outDir, OUTPUT_FILES.methods), 'utf8');
    expect(fresh).toBe(committed);
  });
});
