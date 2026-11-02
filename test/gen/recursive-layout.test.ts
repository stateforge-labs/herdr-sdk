// Role: tests a recursive schema definition (LayoutNode refers to itself) through the params emitter.
// Informs HERDR-ADR-0002 and plan section 3.2 (recursive LayoutNode must emit without looping).
import { describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitParams } from '../../gen/emit-params.ts';
import { loadSchema } from '../../gen/schema.ts';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(TEST_DIR, 'fixtures', 'recursive-layout.schema.json');
const HEADER = '';

const LAYOUT_NAME = 'LayoutNode';

describe('recursive LayoutNode', () => {
  const output = emitParams(loadSchema(FIXTURE_PATH), HEADER);

  test('the union is declared once', () => {
    expect(output).toContain(`export type ${LAYOUT_NAME} =`);
    expect(output.split(`export type ${LAYOUT_NAME} =`).length - 1).toBe(1);
  });

  test('the self references are named, not expanded', () => {
    expect(output).toContain(`"first": ${LAYOUT_NAME};`);
    expect(output).toContain(`"second": ${LAYOUT_NAME};`);
  });

  test('the params that carry the layout point at it', () => {
    expect(output).toContain(`"layout": ${LAYOUT_NAME};`);
  });
});
