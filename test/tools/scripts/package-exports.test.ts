// Role: the package contract of the compiled build: every export condition points at a file dist/ emits, every type is a .d.ts, the bin is JavaScript, and files ship the dist tree.
// Requires `bun run build` (the pretest script runs it). Informs HERDR-ADR-0012 (one artefact for Node and Bun), plan 10.1 and HERDR-ADR-0011 (distribution).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as {
  exports: Record<string, string | { types: string; default: string }>;
  files: string[];
  bin: Record<string, string>;
};
const CONDITION = { Types: 'types', Default: 'default' } as const;

describe('package exports of the compiled build', () => {
  test('every subpath has a .d.ts and a .js under dist/, and none points at src/', () => {
    for (const [subpath, target] of Object.entries(pkg.exports)) {
      if (typeof target === 'string') {
        continue;
      }
      const types = target[CONDITION.Types];
      const js = target[CONDITION.Default];
      assert.ok(types.startsWith('./dist/') && types.endsWith('.d.ts'), `${subpath} types: ${types}`);
      assert.ok(js.startsWith('./dist/') && js.endsWith('.js'), `${subpath} default: ${js}`);
      assert.ok(existsSync(join(PACKAGE_ROOT, types)), `${subpath}: ${types} is missing`);
      assert.ok(existsSync(join(PACKAGE_ROOT, js)), `${subpath}: ${js} is missing`);
    }
  });

  test('the bin is JavaScript and exists', () => {
    for (const target of Object.values(pkg.bin)) {
      assert.ok(target.endsWith('.js'), target);
      assert.ok(existsSync(join(PACKAGE_ROOT, target)), `${target} is missing`);
    }
  });

  test('files ship the dist tree, the bin, the schema, the skill, the generated API docs, the changelog and the notices, not the sources', () => {
    assert.deepEqual(
      [...pkg.files].sort(),
      ['CHANGELOG.md', 'LICENSE', 'NOTICE.md', 'README.md', 'bin', 'dist', 'docs/api', 'schema', 'skills'].sort(),
    );
  });
});
