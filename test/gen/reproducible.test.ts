// Role: the generator is reproducible: a fresh run gives byte-identical src/generated and docs/api files, and the committed files match.
// Informs HERDR-ADR-0002 (the committed output must match a regeneration) and plan section 3.2 (no timestamps in output).
import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DOC_FILES, renderOutputs, runGenerator } from '../../gen/index.ts';
import { GEN_PATHS, loadSchema } from '../../gen/schema.ts';

const scratch: string[] = [];

function freshDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of scratch) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('regeneration', () => {
  const outDir = freshDir('herdr-gen-');
  const docsDir = freshDir('herdr-docs-');
  runGenerator({ schemaPath: GEN_PATHS.schemaPath, outDir, docsDir });

  test('every src/generated file equals the committed file byte for byte', () => {
    for (const file of Object.keys(renderOutputs(loadSchema(GEN_PATHS.schemaPath)))) {
      expect(readFileSync(join(outDir, file), 'utf8')).toBe(readFileSync(join(GEN_PATHS.outDir, file), 'utf8'));
    }
  });

  test('every docs/api file equals the committed file byte for byte', () => {
    for (const file of Object.values(DOC_FILES)) {
      expect(readFileSync(join(docsDir, file), 'utf8')).toBe(readFileSync(join(GEN_PATHS.docsDir, file), 'utf8'));
    }
  });

  test('a second fresh run into new directories gives the same bytes', () => {
    const again = freshDir('herdr-gen-again-');
    const againDocs = freshDir('herdr-docs-again-');
    runGenerator({ schemaPath: GEN_PATHS.schemaPath, outDir: again, docsDir: againDocs });
    for (const file of Object.keys(renderOutputs(loadSchema(GEN_PATHS.schemaPath)))) {
      expect(readFileSync(join(again, file), 'utf8')).toBe(readFileSync(join(outDir, file), 'utf8'));
    }
  });
});
