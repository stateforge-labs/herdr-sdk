// Role: the last step of `bun run build`: rewrites the relative `.ts` specifiers of the emitted .d.ts files to `.js`, so consumers resolve them (tsc emits them unchanged).
// Informs HERDR-ADR-0012 (compiled dist with declarations, no bundler) and plan 10.1; run after tsc, never by consumers. Pure rewrite is exported for tests.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BuildDir = {
  Dist: 'dist',
  DeclarationSuffix: '.d.ts',
  TargetExt: '.js',
} as const;

// A relative module specifier that ends in `.ts`, in an import, export-from, dynamic import() or import type; group 1 is the quote-free path, group 2 the closing quote.
const TS_SPECIFIER = /((?:from|import\(|import)\s*['"])(\.{1,2}\/[^'"]*?)\.ts(['"])/g;

// Pure: the text with each relative `.ts` specifier replaced by `.js`; anything else is left as it is.
export function rewriteDtsText(text: string): string {
  return text.replace(TS_SPECIFIER, (_match, head: string, path: string, close: string) => `${head}${path}${BuildDir.TargetExt}${close}`);
}

// Walks a directory and returns the .d.ts files under it.
export function declarationFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return declarationFiles(path);
    }
    return name.endsWith(BuildDir.DeclarationSuffix) ? [path] : [];
  });
}

function main(): number {
  const dist = join(fileURLToPath(new URL('../..', import.meta.url)), BuildDir.Dist);
  let changed = 0;
  for (const file of declarationFiles(dist)) {
    const before = readFileSync(file, 'utf8');
    const after = rewriteDtsText(before);
    if (after !== before) {
      writeFileSync(file, after);
      changed += 1;
    }
  }
  console.log(`rewrite-dts: ${changed} declaration file(s) rewritten`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
