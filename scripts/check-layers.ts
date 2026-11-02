// Role: gate script `bun run lint:layers`; checks every src/ import and text rule against rules/layers.ts and exits 1 on any violation.
// Informs HERDR-ADR-0003 (layering, zero-dependency core) and plan section 3 (dependency rule); pattern from atalaya ci/dependency-cruiser.cjs (new script, no dependency).
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALLOWED_IMPORTS,
  ENTRY_PACKAGE_ALLOWED,
  EntryFile,
  FOLDER_LAYERS,
  FORBIDDEN_TARGET_DIRS,
  FORBIDDEN_TEXT,
  Layer,
  NODE_FORBIDDEN_LAYERS,
  PACKAGE_ALLOWED,
  PackageName,
  RESTRICTED_FOLDERS,
  RuleId,
  SourcePath,
} from '../rules/layers.ts';
import { extractSpecifiers, stripComments, TEXT, type Specifier } from './import-specifiers.ts';

export interface Violation {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  readonly from: string;
  readonly target: string;
  readonly reason: string;
}

interface SourceFile {
  readonly rel: string;
  readonly abs: string;
  readonly layer: Layer | undefined;
}

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PATH = {
  src: 'src',
  posixSeparator: '/',
  parentDir: '..',
  currentDir: '.',
  tsSuffix: '.ts',
} as const;

const DEPTH = { topLevel: 1 } as const;
const FIRST_LINE = 1;

const EXIT_CODE = { ok: 0, fail: 1 } as const;

const OUTPUT = { okPrefix: 'layers ok' } as const;
const UNKNOWN_LAYER = 'unknown';

// Relative specifiers start with '.'; bare package names do not.
function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith(PATH.currentDir);
}

function toPosix(path: string): string {
  return path.split(sep).join(PATH.posixSeparator);
}

// Every .ts file under src/, as a posix path relative to src/, sorted for stable output.
export function sourceFiles(srcDir: string): readonly string[] {
  return readdirSync(srcDir, { encoding: 'utf8', recursive: true })
    .map((name) => toPosix(name))
    .filter((name) => name.endsWith(PATH.tsSuffix))
    .sort();
}

// Layer of a file under src/, or undefined when its folder is not in the layer table.
export function layerOf(rel: string): Layer | undefined {
  if (rel === SourcePath.Constants || rel === SourcePath.NotImplemented) {
    return Layer.Constants;
  }
  if (rel === SourcePath.ModelFromWire) {
    return Layer.ModelFromWire;
  }
  const parts = rel.split(PATH.posixSeparator);
  if (parts.length === DEPTH.topLevel) {
    return Layer.Entry;
  }
  return FOLDER_LAYERS.find((layer) => layer === parts[0]);
}

function isOutsideSrc(relToSrc: string): boolean {
  return relToSrc.startsWith(PATH.parentDir) || isAbsolute(relToSrc);
}

function outsideReason(rootDir: string, target: string): string {
  const topDir = toPosix(relative(rootDir, target)).split(PATH.posixSeparator)[0] ?? '';
  return FORBIDDEN_TARGET_DIRS.includes(topDir) ? `forbidden directory ${topDir}` : 'outside src';
}

function makeViolation(file: SourceFile, line: number, rule: string, target: string, reason: string): Violation {
  return {
    file: `${PATH.src}${PATH.posixSeparator}${file.rel}`,
    line,
    rule,
    from: file.layer ?? UNKNOWN_LAYER,
    target,
    reason,
  };
}

// A relative import resolves to a file under src/; anything else is checked against the layer table.
function relativeImportViolation(rootDir: string, srcDir: string, file: SourceFile, item: Specifier, from: Layer): Violation | undefined {
  const target = resolve(dirname(file.abs), item.specifier);
  const targetRel = toPosix(relative(srcDir, target));
  if (isOutsideSrc(targetRel)) {
    return makeViolation(file, item.line, RuleId.outside, item.specifier, outsideReason(rootDir, target));
  }
  if (!targetRel.endsWith(PATH.tsSuffix)) {
    return makeViolation(file, item.line, RuleId.explicitTs, item.specifier, 'relative import must name a .ts file');
  }
  const to = layerOf(targetRel);
  if (to === undefined) {
    return makeViolation(file, item.line, RuleId.unknownLayer, targetRel, 'folder is not in the layer table');
  }
  if (!ALLOWED_IMPORTS[from].includes(to)) {
    return makeViolation(file, item.line, RuleId.layer, to, `${to} may not be imported from ${from}`);
  }
  const owner = RESTRICTED_FOLDERS[to];
  if (owner !== undefined && to !== from && file.rel !== owner) {
    return makeViolation(file, item.line, RuleId.restricted, to, `only src/${owner} may import ${to}`);
  }
  return undefined;
}

function packagesAllowedIn(file: SourceFile, from: Layer): readonly string[] {
  return [...PACKAGE_ALLOWED[from], ...(ENTRY_PACKAGE_ALLOWED[file.rel] ?? [])];
}

function isPackageNamed(specifier: string, name: string): boolean {
  return specifier === name || specifier.startsWith(`${name}${PATH.posixSeparator}`);
}

function bareImportViolation(file: SourceFile, item: Specifier, from: Layer): Violation | undefined {
  if (item.specifier.startsWith(PackageName.NodeBuiltinPrefix)) {
    return NODE_FORBIDDEN_LAYERS.includes(from)
      ? makeViolation(file, item.line, RuleId.nodeBuiltin, item.specifier, `${from} may not use node builtins`)
      : undefined;
  }
  const allowed = packagesAllowedIn(file, from).some((name) => isPackageNamed(item.specifier, name));
  return allowed
    ? undefined
    : makeViolation(file, item.line, RuleId.package, item.specifier, `bare package not allowed in ${from}`);
}

function importViolation(rootDir: string, srcDir: string, file: SourceFile, item: Specifier, from: Layer): Violation | undefined {
  return isRelativeSpecifier(item.specifier)
    ? relativeImportViolation(rootDir, srcDir, file, item, from)
    : bareImportViolation(file, item, from);
}

// A text rule with `layers` checks only the files of those layers.
function appliesTo(rule: { readonly layers?: readonly Layer[] }, file: SourceFile): boolean {
  return rule.layers === undefined || (file.layer !== undefined && rule.layers.includes(file.layer));
}

function textViolations(file: SourceFile, code: string): readonly Violation[] {
  const lines = code.split(TEXT.newline);
  return FORBIDDEN_TEXT.filter((rule) => appliesTo(rule, file)).flatMap((rule) =>
    lines.flatMap((text, index) =>
      rule.pattern.test(text)
        ? [makeViolation(file, index + FIRST_LINE, RuleId.text, rule.id, rule.reason)]
        : [],
    ),
  );
}

function checkFile(rootDir: string, srcDir: string, rel: string): readonly Violation[] {
  const abs = join(srcDir, rel);
  const source = readFileSync(abs, 'utf8');
  const file: SourceFile = { rel, abs, layer: layerOf(rel) };
  if (file.layer === undefined) {
    return [makeViolation(file, FIRST_LINE, RuleId.unknownLayer, rel, 'folder is not in the layer table')];
  }
  const from = file.layer;
  const importViolations = extractSpecifiers(source).flatMap((item) => {
    const violation = importViolation(rootDir, srcDir, file, item, from);
    return violation === undefined ? [] : [violation];
  });
  return [...importViolations, ...textViolations(file, stripComments(source))];
}

// Pure apart from reading the files under rootDir/src; tests call it on fixture packages.
export function checkLayers(rootDir: string = PACKAGE_ROOT): readonly Violation[] {
  const srcDir = join(rootDir, PATH.src);
  return sourceFiles(srcDir).flatMap((rel) => checkFile(rootDir, srcDir, rel));
}

export function formatViolation(violation: Violation): string {
  return `${violation.file}:${violation.line} ${violation.rule}: ${violation.from} -> ${violation.target} (${violation.reason})`;
}

export function main(rootDir: string = PACKAGE_ROOT): number {
  const violations = checkLayers(rootDir);
  if (violations.length === 0) {
    const count = sourceFiles(join(rootDir, PATH.src)).length;
    process.stdout.write(`${OUTPUT.okPrefix} (${count} files)\n`);
    return EXIT_CODE.ok;
  }
  for (const violation of violations) {
    process.stdout.write(`${formatViolation(violation)}\n`);
  }
  return EXIT_CODE.fail;
}

if (import.meta.main) {
  process.exit(main());
}
