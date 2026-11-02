// Role: the plan's coverage acceptance test: the result map covers every request method of the committed schema, and the generated modules agree with it.
// Informs HERDR-ADR-0002 and plan section 4.2 (every method has a row; the fake's default replies agree with the mapping; the seed rows survive).
import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_RESULT, METHOD_RESULT, METHODS } from '../src/generated/index.ts';
import { checkResultMap } from '../gen/check-result-map.ts';
import { DOC_FILES, OUTPUT_FILES, runGenerator } from '../gen/index.ts';
import { isLoose, methodResultTags, METHOD_RESULT_MAP, RESULT_KIND, RESULT_SOURCE } from '../gen/method-result-map.ts';
import { GEN_PATHS, loadSchema } from '../gen/schema.ts';

const EXPECTED_METHODS = 102;
// Sources a typed row may name without a ref (a name match or an atalaya seed); every other typed source needs a ref.
const SOURCES_WITHOUT_REF: ReadonlySet<string> = new Set([RESULT_SOURCE.seed, RESULT_SOURCE.name]);
const SEED_ROWS: Readonly<Record<string, string>> = {
  'ping': 'pong',
  'session.snapshot': 'session_snapshot',
  'workspace.create': 'workspace_created',
  'workspace.list': 'workspace_list',
  'workspace.get': 'workspace_info',
  'worktree.list': 'worktree_list',
  'worktree.create': 'worktree_created',
  'worktree.open': 'worktree_opened',
  'worktree.remove': 'worktree_removed',
  'tab.create': 'tab_created',
  'tab.list': 'tab_list',
  'tab.get': 'tab_info',
  'agent.list': 'agent_list',
  'agent.get': 'agent_info',
  'agent.read': 'pane_read',
  'agent.start': 'agent_started',
  'agent.prompt': 'agent_prompted',
  'agent.wait': 'agent_info',
  'agent.view.set': 'agent_view',
  'agent.view.clear': 'agent_view',
  'pane.list': 'pane_list',
  'pane.current': 'pane_current',
  'pane.get': 'pane_info',
  'pane.read': 'pane_read',
  'events.subscribe': 'subscription_started',
};

const committed = loadSchema(GEN_PATHS.schemaPath);
const methodNames = METHODS.map((row) => row.name);
const mapNames = Object.keys(METHOD_RESULT_MAP);
const looseCount = Object.values(METHOD_RESULT_MAP).filter(isLoose).length;
const defaults: Readonly<Record<string, { readonly type: string }>> = DEFAULT_RESULT;

describe('coverage of the committed schema', () => {
  test('there are 102 request methods, and the map has one row for each', () => {
    expect(methodNames.length).toBe(EXPECTED_METHODS);
    expect(new Set(mapNames)).toEqual(new Set(methodNames));
  });

  test('the generator check reports no problem', () => {
    expect(checkResultMap(committed, METHOD_RESULT_MAP)).toEqual([]);
  });

  test('every key of METHOD_RESULT is a method with a typed row', () => {
    for (const method of Object.keys(METHOD_RESULT)) {
      expect(METHOD_RESULT_MAP[method]?.kind).toBe(RESULT_KIND.typed);
    }
  });

  test('METHOD_RESULT plus the LOOSE rows account for every method', () => {
    expect(Object.keys(METHOD_RESULT).length + looseCount).toBe(methodNames.length);
  });

  test('METHOD_RESULT is the typed projection of the map', () => {
    expect(METHOD_RESULT).toEqual(methodResultTags());
  });

  test('every METHOD_RESULT tag is a key of ResultByTag (a DEFAULT_RESULT key)', () => {
    const tags = new Set(Object.keys(DEFAULT_RESULT));
    for (const tag of Object.values(METHOD_RESULT)) {
      expect(tags.has(tag)).toBe(true);
    }
  });

  test('the fake default reply of every typed method carries the mapped tag', () => {
    for (const [method, tag] of Object.entries(METHOD_RESULT)) {
      expect(defaults[tag]?.type, method).toBe(tag);
    }
  });

  test('the only typed sources are seed, name, docs and recorded', () => {
    expect(Object.values(RESULT_SOURCE).sort()).toEqual(['docs', 'name', 'recorded', 'seed']);
  });

  test('every typed row names a source, and every row beyond seed and name carries a ref', () => {
    for (const row of Object.values(METHOD_RESULT_MAP)) {
      if (row.kind === RESULT_KIND.typed) {
        expect(Object.values(RESULT_SOURCE)).toContain(row.source);
        if (!SOURCES_WITHOUT_REF.has(row.source)) {
          expect(row.ref).toBeDefined();
        }
      }
    }
  });

  test('every LOOSE row carries a reason', () => {
    for (const row of Object.values(METHOD_RESULT_MAP)) {
      if (row.kind === RESULT_KIND.loose) {
        expect(row.reason.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('each of the 25 seed rows survives with source seed and its original tag', () => {
    expect(Object.keys(SEED_ROWS).length).toBe(25);
    for (const [method, tag] of Object.entries(SEED_ROWS)) {
      expect(METHOD_RESULT_MAP[method]).toEqual({ kind: RESULT_KIND.typed, tag, source: RESULT_SOURCE.seed });
    }
  });

  test('a fresh generator run reproduces src/generated and docs/api byte for byte', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'herdr-coverage-gen-'));
    try {
      const outDir = join(scratch, 'generated');
      const docsDir = join(scratch, 'api');
      runGenerator({ schemaPath: GEN_PATHS.schemaPath, outDir, docsDir });
      for (const file of Object.values(OUTPUT_FILES)) {
        expect(readFileSync(join(outDir, file), 'utf8')).toBe(readFileSync(join(GEN_PATHS.outDir, file), 'utf8'));
      }
      for (const file of Object.values(DOC_FILES)) {
        expect(readFileSync(join(docsDir, file), 'utf8')).toBe(readFileSync(join(GEN_PATHS.docsDir, file), 'utf8'));
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
