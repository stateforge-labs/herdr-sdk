// Role: the declaration-specifier rewrite of the build (tools/scripts/rewrite-dts.ts) on fixed declaration text (pure).
// Informs HERDR-ADR-0012 (compiled dist with declarations) and plan 10.1: consumers must resolve the .d.ts imports to dist files.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteDtsText } from '../../../tools/scripts/rewrite-dts.ts';

describe('rewriteDtsText', () => {
  test('rewrites relative .ts specifiers of export-from, import type and import() to .js', () => {
    const text = [
      "export { connect } from './client/connect.ts';",
      "export type { Hold } from './client/held/types.ts';",
      "import type { ConnectReadOnly } from '../../types.ts';",
      'type X = import("./constants.ts").Thing;',
    ].join('\n');
    assert.equal(
      rewriteDtsText(text),
      [
        "export { connect } from './client/connect.js';",
        "export type { Hold } from './client/held/types.js';",
        "import type { ConnectReadOnly } from '../../types.js';",
        'type X = import("./constants.js").Thing;',
      ].join('\n'),
    );
  });

  test('leaves package specifiers, .d.ts specifiers and text that is not an import alone', () => {
    const text = "import { x } from 'effect';\nimport type { Y } from './a.d.ts';\n// see ./notes.ts";
    assert.equal(rewriteDtsText(text), "import { x } from 'effect';\nimport type { Y } from './a.d.js';\n// see ./notes.ts");
  });
});
