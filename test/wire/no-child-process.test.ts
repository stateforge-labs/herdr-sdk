// Role: guards the spawn rule: no file in src/wire or src/client imports node:child_process (or child_process).
// Informs HERDR-ADR-0003 (P1: the runtime never spawns herdr) and HERDR-ADR-0016 (the runtime never spawns herdr); new test using scripts/import-specifiers.ts.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSpecifiers } from '../../scripts/import-specifiers.ts';

const PACKAGE_FILE = 'package.json';
const GUARDED_DIRS = ['wire', 'client'] as const;
const TS_SUFFIX = '.ts';
const FORBIDDEN_SPAWN_MODULES = ['node:child_process', 'child_process'] as const;

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

// Every .ts file under the guarded folders that exist (client/ arrives in phase 2a part 2).
function guardedSourceFiles(): string[] {
  return GUARDED_DIRS.flatMap((folder) => {
    const dir = join(PACKAGE_ROOT, 'src', folder);
    if (!existsSync(dir)) {
      return [];
    }
    return readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((name) => name.endsWith(TS_SUFFIX))
      .map((name) => join(dir, name));
  });
}

describe('spawn guard', () => {
  test('no guarded file imports child_process', () => {
    const files = guardedSourceFiles();
    assert.ok(files.length > 0, 'expected guarded source files');
    for (const file of files) {
      const specifiers = extractSpecifiers(readFileSync(file, 'utf8')).map((item) => item.specifier);
      for (const forbidden of FORBIDDEN_SPAWN_MODULES) {
        assert.equal(specifiers.includes(forbidden), false, `${file} imports ${forbidden}`);
      }
    }
  });
});
