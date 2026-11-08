// Role: tests params shared by several methods, and untagged unions, through the params emitter.
// Informs HERDR-ADR-0002 and plan section 3.2 (shared params types: EmptyParams and PaneTarget are emitted once).
import { describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitParams } from '../../../tools/gen/emit-params.ts';
import { loadSchema } from '../../../tools/gen/schema.ts';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(TEST_DIR, 'fixtures', 'shared-params.schema.json');
const HEADER = '';

const SHARED = { empty: 'EmptyParams', target: 'PaneTarget' } as const;

describe('shared params types', () => {
  const output = emitParams(loadSchema(FIXTURE_PATH), HEADER);

  test('EmptyParams is declared once', () => {
    expect(output.split(`export type ${SHARED.empty} =`).length - 1).toBe(1);
  });

  test('three methods point at EmptyParams', () => {
    expect(output).toContain(`"ping": ${SHARED.empty};`);
    expect(output).toContain(`"server.stop": ${SHARED.empty};`);
    expect(output).toContain(`"session.snapshot": ${SHARED.empty};`);
  });

  test('two methods point at PaneTarget', () => {
    expect(output).toContain(`"pane.get": ${SHARED.target};`);
    expect(output).toContain(`"pane.focus": ${SHARED.target};`);
  });
});

describe('untagged union', () => {
  const output = emitParams(loadSchema(FIXTURE_PATH), HEADER);

  test('emits both members of the PopupSize-like union', () => {
    expect(output).toContain('export type PopupSize = (number) | (string);');
  });
});
