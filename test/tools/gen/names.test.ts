// Role: tests of the name tables (tools/gen/emit-names.ts), const-key rules (tools/gen/const-key.ts) and the token key pattern.
// Informs HERDR-ADR-0002 and plan section 3.2; counts follow the published schema.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertUniqueKeys, constKey } from '../../../tools/gen/const-key.ts';
import { tokenNamePattern } from '../../../tools/gen/emit-names.ts';
import { renderOutputs } from '../../../tools/gen/index.ts';
import { GEN_PATHS, loadSchema } from '../../../tools/gen/schema.ts';
import { AgentStatus, EventKind, EventMatchKind, Method, ResultTag, SubscriptionEventKind, SubscriptionType, TOKEN_NAME_PATTERN } from '../../../src/herdr/generated/index.ts';
import { ApiSchemaFixture } from './fixture-paths.ts';

const schema = loadSchema(GEN_PATHS.schemaPath);

const COUNTS = {
  methods: 102, eventKinds: 26, subscriptionEventKinds: 3, subscriptionTypes: 27,
  eventMatchKinds: 19, resultTags: 63, agentStatuses: 5,
} as const;

describe('const-key', () => {
  test('dotted and underscored wire names become PascalCase keys', () => {
    expect(constKey('pane.selection.read')).toBe('PaneSelectionRead');
    expect(constKey('workspace_created')).toBe('WorkspaceCreated');
    expect(constKey('pong')).toBe('Pong');
  });

  test('a collision between separators is refused', () => {
    expect(() => assertUniqueKeys(['a.b', 'a_b'])).toThrow("duplicate constant key 'AB'");
  });

  test('distinct names pass', () => {
    expect(() => assertUniqueKeys(['a.b', 'a.c'])).not.toThrow();
  });
});

describe('name table counts from the src/herdr/generated module', () => {
  test('counts match the published schema', () => {
    expect(Object.keys(Method).length).toBe(COUNTS.methods);
    expect(Object.keys(EventKind).length).toBe(COUNTS.eventKinds);
    expect(Object.keys(SubscriptionEventKind).length).toBe(COUNTS.subscriptionEventKinds);
    expect(Object.keys(SubscriptionType).length).toBe(COUNTS.subscriptionTypes);
    expect(Object.keys(EventMatchKind).length).toBe(COUNTS.eventMatchKinds);
    expect(Object.keys(ResultTag).length).toBe(COUNTS.resultTags);
    expect(Object.keys(AgentStatus).length).toBe(COUNTS.agentStatuses);
  });

  test('every key is the constKey of its value', () => {
    for (const table of [Method, EventKind, SubscriptionEventKind, SubscriptionType, EventMatchKind, ResultTag, AgentStatus]) {
      for (const [key, value] of Object.entries(table)) {
        expect(key).toBe(constKey(value));
      }
    }
  });

  test('Method.PaneList is the wire name pane.list', () => {
    expect(Method.PaneList).toBe('pane.list');
  });
});

describe('token key pattern', () => {
  test('TOKEN_NAME_PATTERN equals the one pattern in the schema', () => {
    expect(TOKEN_NAME_PATTERN).toBe(tokenNamePattern(schema));
    expect(TOKEN_NAME_PATTERN).toBe('^[A-Za-z0-9_-]{1,32}$');
  });

  test('two different token patterns are refused', () => {
    const fixture = loadSchema(ApiSchemaFixture.tokenPatternsDiffer);
    expect(() => tokenNamePattern(fixture)).toThrow('token key patterns differ');
  });
});

describe('determinism of the names modules', () => {
  test('every renderOutputs names/ file is the committed file', () => {
    const nameFiles = Object.keys(renderOutputs(schema)).filter((path) => path.startsWith('names/'));
    expect(nameFiles.length).toBeGreaterThan(0);
    for (const path of nameFiles) {
      expect(renderOutputs(schema)[path]).toBe(readFileSync(join(GEN_PATHS.outDir, path), 'utf8'));
    }
  });
});
