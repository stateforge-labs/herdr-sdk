// Role: tests of the import extractor (tools/scripts/import-specifiers.ts) on inline source text; no files, no network.
// Informs HERDR-ADR-0003 (layer rule input) and plan section 3 (dependency rule).
import { describe, expect, test } from 'bun:test';
import { extractSpecifiers, stripComments } from '../../../tools/scripts/import-specifiers.ts';

function pairs(source: string): readonly (readonly [string, number, boolean])[] {
  return extractSpecifiers(source).map((item) => [item.specifier, item.line, item.typeOnly] as const);
}

describe('extractSpecifiers', () => {
  test('reads static, type-only, side-effect and re-export forms with their lines', () => {
    const source = [
      "import { a } from './a.ts';",
      "import type { B } from '../../b.ts';",
      "import './side.ts';",
      "export * from './c.ts';",
      "export type { D } from './d.ts';",
    ].join('\n');
    expect(pairs(source)).toEqual([
      ['./a.ts', 1, false],
      ['../../b.ts', 2, true],
      ['./side.ts', 3, false],
      ['./c.ts', 4, false],
      ['./d.ts', 5, true],
    ]);
  });

  test('reports a multi-line import at the line where the statement starts', () => {
    const source = ["import {", "  x,", "} from 'node:fs';", "export const load = () => import('../../client/tree.ts');"].join('\n');
    expect(pairs(source)).toEqual([
      ['node:fs', 1, false],
      ['../../client/tree.ts', 4, false],
    ]);
  });

  test('ignores imports that appear only in comments', () => {
    const source = ["// import { z } from 'not-a-package';", "/* import y from 'also-not'; */", "import { ok } from './ok.ts';"].join('\n');
    expect(pairs(source)).toEqual([['./ok.ts', 3, false]]);
  });

  test('ignores an import that appears only in a trailing comment', () => {
    const source = "const a = 1; // see import x from '../../client/a.ts'";
    expect(pairs(source)).toEqual([]);
  });

  test('keeps a real import that follows a string containing a block-comment opener', () => {
    const source = ['const s = "/*";', "import z from '../../client/c.ts';", 'const e = "*/";'].join('\n');
    expect(pairs(source)).toEqual([['../../client/c.ts', 2, false]]);
  });

  test('ignores an import-looking text inside a string literal', () => {
    const source = ["const s = \"import y from '../../client/d.ts'\";", "import { ok } from './ok.ts';"].join('\n');
    expect(pairs(source)).toEqual([['./ok.ts', 2, false]]);
  });

  test('does not join a function declaration with a later import line', () => {
    const source = ['export function f() {}', "import a from 'b';"].join('\n');
    expect(pairs(source)).toEqual([['b', 2, false]]);
  });

  test('stripComments keeps the newline count so line numbers stay true', () => {
    const source = ['/* one', 'two */', '// three', 'four'].join('\n');
    expect(stripComments(source).split('\n')).toHaveLength(4);
  });
});
