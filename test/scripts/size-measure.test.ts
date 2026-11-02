// Role: the bundle reader of the size gate on hand-made bun metafiles: static closure, lazy bytes, contributing inputs and forbidden fragments (pure).
// Informs plan 10.1 (lazy streams row) and HERDR-ADR-0015 (the no-leak check reads inputs of each bundle).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { leakedInputs, leakedText, measureMeta, staticClosure, type Meta } from '../../scripts/size-measure.ts';
import { SizeImportKind } from '../../scripts/size-constants.ts';

const meta: Meta = {
  outputs: {
    './index.js': {
      bytes: 100,
      entryPoint: 'index.ts',
      imports: [
        { path: './chunk-a.js', kind: SizeImportKind.Static },
        { path: './lazy-b.js', kind: SizeImportKind.Dynamic },
      ],
      inputs: { 'dist/index.js': {} },
    },
    './chunk-a.js': { bytes: 40, imports: [], inputs: { 'dist/client/a.js': {} } },
    './lazy-b.js': { bytes: 25, imports: [], inputs: { 'dist/client/streams.js': {} } },
  },
};

describe('staticClosure', () => {
  test('follows static imports from the entry and leaves dynamic imports out', () => {
    assert.deepEqual([...staticClosure(meta)].sort(), ['./chunk-a.js', './index.js']);
  });
});

describe('staticClosure with a chunk bun marks as an entry', () => {
  // bun gives the dynamically imported module its own entryPoint; it must still count as lazy, not as a root.
  const splitMeta: Meta = {
    outputs: {
      './index.js': {
        bytes: 100,
        entryPoint: 'index.ts',
        imports: [{ path: './streams.js', kind: SizeImportKind.Dynamic }],
        inputs: { 'dist/index.js': {} },
      },
      './streams.js': {
        bytes: 25,
        entryPoint: 'dist/client/scoped/streams.js',
        imports: [],
        inputs: { 'dist/client/scoped/streams.js': {} },
      },
    },
  };

  test('the dynamic target is not a root, so its bytes are lazy', () => {
    assert.deepEqual([...staticClosure(splitMeta)], ['./index.js']);
    assert.equal(measureMeta(splitMeta).bytes, 100);
    assert.equal(measureMeta(splitMeta).lazyBytes, 25);
  });
});

describe('measureMeta', () => {
  test('sums the static closure as bytes and the rest as lazy bytes, and lists every contributing input once', () => {
    const measured = measureMeta(meta);
    assert.equal(measured.bytes, 140);
    assert.equal(measured.lazyBytes, 25);
    assert.deepEqual(measured.inputs, ['dist/client/a.js', 'dist/client/streams.js', 'dist/index.js']);
  });
});

describe('leakedInputs and leakedText', () => {
  test('returns the inputs that contain a forbidden fragment', () => {
    assert.deepEqual(leakedInputs(['dist/index.js', 'dist/generated/method-table.js'], ['/generated/method-table']), [
      'dist/generated/method-table.js',
    ]);
  });

  test('returns the fragments that appear in the text', () => {
    assert.deepEqual(leakedText('import "node:child_process"', ['child_process', 'test-kit']), ['child_process']);
    assert.deepEqual(leakedText('export {}', ['child_process']), []);
  });
});
