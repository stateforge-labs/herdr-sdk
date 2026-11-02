// Role: tests of the layer gate (scripts/check-layers.ts) on fixture packages and on the real package; no network, no herdr.
// Informs HERDR-ADR-0003 (layering, restricted test-kit and mcp folders) and plan section 3 (dependency rule).
import { describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_LAYERS, ALLOWED_IMPORTS, Layer, RuleId } from '../../rules/layers.ts';
import { checkLayers, formatViolation, layerOf } from '../../scripts/check-layers.ts';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(TEST_DIR, '..', '..');
const FIXTURES = join(TEST_DIR, 'fixtures', 'layers');

const FIXTURE_RULES = [
  { name: 'wire-imports-client', rules: [RuleId.layer] },
  { name: 'dynamic-import', rules: [RuleId.layer] },
  { name: 'generated-imports-wire', rules: [RuleId.layer] },
  { name: 'entities-import-generated', rules: [RuleId.layer] },
  { name: 'imports-test-kit', rules: [RuleId.layer, RuleId.restricted] },
  { name: 'effect-in-client', rules: [RuleId.package] },
  { name: 'src-imports-gen', rules: [RuleId.outside] },
  { name: 'bun-global', rules: [RuleId.text] },
  { name: 'node-in-generated', rules: [RuleId.nodeBuiltin] },
  { name: 'unknown-folder', rules: [RuleId.unknownLayer] },
  { name: 'no-ts-extension', rules: [RuleId.explicitTs] },
  { name: 'trailing-comment-ok', rules: [] },
  { name: 'block-opener-in-string', rules: [RuleId.layer] },
  { name: 'method-value-in-client', rules: [RuleId.text, RuleId.text] },
  { name: 'method-type-only', rules: [] },
] as const;

function rulesOf(name: string): readonly string[] {
  return checkLayers(join(FIXTURES, name)).map((violation) => violation.rule);
}

describe('checkLayers on fixtures', () => {
  test('a package that follows the rule has no violations', () => {
    expect(checkLayers(join(FIXTURES, 'ok'))).toEqual([]);
  });

  test.each(FIXTURE_RULES)('$name reports the expected rule ids', ({ name, rules }) => {
    expect(rulesOf(name)).toEqual(rules);
  });

  test('the report names the file, the line and both layers', () => {
    const [violation] = checkLayers(join(FIXTURES, 'wire-imports-client'));
    expect(violation).toBeDefined();
    expect(formatViolation(violation!)).toBe(
      'src/wire/a.ts:1 layer-rule: wire -> client (client may not be imported from wire)',
    );
  });
});

describe('checkLayers on the real package', () => {
  test('src/ passes the layer rule', () => {
    expect(checkLayers(PACKAGE_ROOT)).toEqual([]);
  });
});

describe('layerOf', () => {
  test.each([
    ['constants.ts', Layer.Constants],
    ['model/from-wire.ts', Layer.ModelFromWire],
    ['model/entities.ts', Layer.Model],
    ['generated/names.ts', Layer.Generated],
    ['effect.ts', Layer.Entry],
    ['mystery/a.ts', undefined],
  ] as const)('%s is in layer %p', (rel, expected) => {
    expect(layerOf(rel)).toBe(expected);
  });
});

describe('layer table', () => {
  test('every layer has an import row', () => {
    expect(Object.keys(ALLOWED_IMPORTS).sort()).toEqual([...ALL_LAYERS].sort());
  });

  test('only the entry layer may import the entry layer', () => {
    const importers = ALL_LAYERS.filter((layer) => ALLOWED_IMPORTS[layer].includes(Layer.Entry));
    expect(importers).toEqual([Layer.Entry]);
  });
});
