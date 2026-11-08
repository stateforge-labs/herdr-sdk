// Role: tests of the METHODS generator (tools/gen/emit-method-table.ts, tools/gen/index.ts) against the committed schema and a fixture.
// Informs HERDR-ADR-0002 and plan section 3.2; the committed output must be reproducible.
import { afterAll, describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { METHODS } from '../../../src/herdr/generated/method-table.ts';
import { methodRows, namespaceOf } from '../../../tools/gen/emit-method-table.ts';
import type { ApiSchema } from '../../../tools/gen/schema.ts';
import { branchesOf, constOf, GEN_PATHS, loadSchema, requestNamespace, SCHEMA_KEY, SCHEMA_NAMESPACE } from '../../../tools/gen/schema.ts';
import { methodRows as tableRows } from '../../../tools/gen/emit-method-table.ts';
import { METHOD_CLASS } from '../../../tools/gen/capabilities.ts';
import { isLoose, METHOD_RESULT_MAP, RESULT_KIND } from '../../../tools/gen/method-result-map.ts';

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
    expect(methodRows(fixture).map((row) => [row.name, row.ns])).toEqual([
      [FIXTURE_METHOD.ping, []],
      [FIXTURE_METHOD.paneList, ['pane']],
      [FIXTURE_METHOD.paneSelectionRead, ['pane', 'selection']],
    ]);
  });

  test('each fixture row carries its class, mapped result and long-poll flag', () => {
    expect(tableRows(fixture)).toEqual([
      { name: FIXTURE_METHOD.ping, class: 'R-meta', result: 'pong', ns: [], longPoll: false },
      { name: FIXTURE_METHOD.paneList, class: 'R-meta', result: 'pane_list', ns: ['pane'], longPoll: false },
      { name: FIXTURE_METHOD.paneSelectionRead, class: 'R-content', result: null, ns: ['pane', 'selection'], longPoll: false },
    ]);
  });

  test('a duplicate method const is refused', () => {
    const branches = branchesOf(requestNamespace(fixture));
    const duplicated: ApiSchema = {
      ...fixture,
      schemas: { [SCHEMA_NAMESPACE.request]: { oneOf: [...branches, branches[0]!] } },
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
      schemas: { [SCHEMA_NAMESPACE.request]: { oneOf: [...branches, numeric] } },
    };
    expect(() => methodRows(broken)).toThrow(NON_STRING_ERROR);
  });
});

describe('full table of the committed schema', () => {
  const committed = loadSchema(GEN_PATHS.schemaPath);
  const rows = tableRows(committed);

  test('every row class equals its METHOD_CLASS row', () => {
    for (const row of rows) {
      expect(row.class).toBe(METHOD_CLASS[row.name]?.class);
    }
  });

  test('longPoll is true for exactly the six long-poll methods', () => {
    const longPoll = rows.filter((row) => row.longPoll).map((row) => row.name).sort();
    expect(longPoll).toEqual([
      'agent.prompt', 'agent.start', 'agent.wait', 'events.subscribe', 'events.wait', 'pane.wait_for_output',
    ]);
  });

  test('result is null exactly for the LOOSE rows of the map', () => {
    for (const row of rows) {
      const mapped = METHOD_RESULT_MAP[row.name];
      expect(row.result === null).toBe(mapped !== undefined && isLoose(mapped));
    }
  });

  test('every result is the tag of its typed row', () => {
    for (const row of rows) {
      const mapped = METHOD_RESULT_MAP[row.name];
      expect(row.result).toBe(mapped?.kind === RESULT_KIND.typed ? mapped.tag : null);
    }
  });
});
