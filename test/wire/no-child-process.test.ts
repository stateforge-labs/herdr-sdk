// Role: guards the spawn rule: no file in src/ imports node:child_process (or child_process) or calls Bun.spawn.
// Informs HERDR-ADR-0003 (P1: the runtime never spawns herdr) and HERDR-ADR-0016 (the runtime never spawns herdr); new test using scripts/import-specifiers.ts.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSpecifiers } from '../../scripts/import-specifiers.ts';

const PACKAGE_FILE = 'package.json';
const GUARDED_ROOT = 'src';
const TS_SUFFIX = '.ts';
const FORBIDDEN_SPAWN_MODULES = ['node:child_process', 'child_process'] as const;
const BUN_SPAWN = 'Bun.spawn';

// The package root is the nearest folder above this file that has a package.json: the same root for test/ and for dist-test/.
function findPackageRoot(start: string): string {
  let dir = start;
  while (!existsSync(join(dir, PACKAGE_FILE))) {
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`no ${PACKAGE_FILE} above ${start}`);
    }
    dir = parent;
  }
  return dir;
}

const PACKAGE_ROOT = findPackageRoot(dirname(fileURLToPath(import.meta.url)));

// Every .ts file under src/ (the whole source tree, so a spawn in any layer is caught).
function guardedSourceFiles(): string[] {
  const dir = join(PACKAGE_ROOT, GUARDED_ROOT);
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith(TS_SUFFIX))
    .map((name) => join(dir, name));
}

describe('spawn guard', () => {
  test('no source file imports child_process', () => {
    const files = guardedSourceFiles();
    assert.ok(files.length > 0, 'expected source files');
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const specifiers = extractSpecifiers(source).map((item) => item.specifier);
      for (const forbidden of FORBIDDEN_SPAWN_MODULES) {
        assert.equal(specifiers.includes(forbidden), false, `${file} imports ${forbidden}`);
      }
      assert.equal(source.includes(BUN_SPAWN), false, `${file} calls ${BUN_SPAWN}`);
    }
  });
});
