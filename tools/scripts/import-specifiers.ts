// Role: extracts module specifiers from TypeScript source text (static, type-only, side-effect and dynamic imports) with 1-based line numbers; one scanner finds comments and string literals so only real code is matched.
// Informs HERDR-ADR-0003 (layer rule input) and plan section 3 (dependency rule); used by tools/scripts/check-layers.ts; new.

export interface Specifier {
  readonly specifier: string;
  readonly line: number;
  readonly typeOnly: boolean;
}

// A half-open [start, end) range of source offsets.
export interface Span {
  readonly start: number;
  readonly end: number;
}

interface ScannedLiterals {
  readonly comments: readonly Span[];
  readonly strings: readonly Span[];
}

interface Literal {
  readonly kind: LiteralKind;
  readonly span: Span;
  // Offset where scanning resumes; always past the literal, so the scan makes progress.
  readonly next: number;
}

export const TEXT = { newline: '\n' } as const;

// The characters the scanner compares against.
const CHAR = {
  backslash: '\\',
  newline: '\n',
  space: ' ',
  single: "'",
  double: '"',
  backtick: '`',
} as const;

const DELIMITER = {
  lineComment: '//',
  blockOpen: '/*',
  blockClose: '*/',
} as const;

const LiteralKind = {
  comment: 'comment',
  string: 'string',
} as const;
type LiteralKind = (typeof LiteralKind)[keyof typeof LiteralKind];

const NOT_FOUND = -1;

// `import x from 'a'`, `export * from 'a'`, `import type { X } from 'a'`, `import 'a'`.
// The middle part only allows identifiers, braces, commas and stars, so a match never spans a statement with `=` or `(`.
const STATIC_IMPORT = /\b(import|export)\s+(type\s+)?(?:[\w\s{},*]*?\bfrom\s+)?['"]([^'"\n]+)['"]/gd;
const DYNAMIC_IMPORT = /\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/gd;

const TYPE_KEYWORD_GROUP = 2;
const SPECIFIER_GROUP = 3;
const DYNAMIC_SPECIFIER_GROUP = 1;
const FIRST_LINE = 1;

// Index of the closing quote (or the newline or end of source that ends the literal), skipping escaped characters.
function closeIndex(source: string, from: number, closer: string): number {
  const isTemplate = closer === CHAR.backtick;
  let index = from;
  while (index < source.length) {
    const ch = source.charAt(index);
    if (ch === CHAR.backslash) {
      index += 2;
    } else if (ch === closer || (!isTemplate && ch === CHAR.newline)) {
      return index;
    } else {
      index += 1;
    }
  }
  return source.length;
}

function commentAt(source: string, index: number): Literal | undefined {
  if (source.startsWith(DELIMITER.lineComment, index)) {
    const newline = source.indexOf(CHAR.newline, index);
    const end = newline === NOT_FOUND ? source.length : newline;
    return { kind: LiteralKind.comment, span: { start: index, end }, next: end };
  }
  if (source.startsWith(DELIMITER.blockOpen, index)) {
    const close = source.indexOf(DELIMITER.blockClose, index + DELIMITER.blockOpen.length);
    const end = close === NOT_FOUND ? source.length : close + DELIMITER.blockClose.length;
    return { kind: LiteralKind.comment, span: { start: index, end }, next: end };
  }
  return undefined;
}

// Span of a string literal is its contents, without the quotes.
function stringAt(source: string, index: number): Literal | undefined {
  const opener = source.charAt(index);
  if (opener !== CHAR.single && opener !== CHAR.double && opener !== CHAR.backtick) {
    return undefined;
  }
  const close = closeIndex(source, index + 1, opener);
  return { kind: LiteralKind.string, span: { start: index + 1, end: close }, next: close + 1 };
}

function literalAt(source: string, index: number): Literal | undefined {
  return commentAt(source, index) ?? stringAt(source, index);
}

// Finds every comment and string literal, so the matcher never reads text inside them.
function scanLiterals(source: string): ScannedLiterals {
  const comments: Span[] = [];
  const strings: Span[] = [];
  let index = 0;
  while (index < source.length) {
    const literal = literalAt(source, index);
    if (literal === undefined) {
      index += 1;
    } else {
      if (literal.kind === LiteralKind.comment) {
        comments.push(literal.span);
      } else {
        strings.push(literal.span);
      }
      index = literal.next;
    }
  }
  return { comments, strings };
}

// Replaces every character inside the spans with a space; newlines stay, so offsets and line numbers are unchanged.
function blankSpans(source: string, spans: readonly Span[]): string {
  const chars = source.split('');
  for (const span of spans) {
    for (let index = span.start; index < span.end; index += 1) {
      if (chars[index] !== CHAR.newline) {
        chars[index] = CHAR.space;
      }
    }
  }
  return chars.join('');
}

// Comments become spaces; string literals are kept as written.
export function stripComments(source: string): string {
  return blankSpans(source, scanLiterals(source).comments);
}

// Comments and string contents become spaces; the matcher runs on this view, the specifier text is read from the source.
function matchingView(source: string): string {
  const scanned = scanLiterals(source);
  return blankSpans(source, [...scanned.comments, ...scanned.strings]);
}

function lineAt(view: string, index: number): number {
  const newlines = view.slice(0, index).split(TEXT.newline).length - FIRST_LINE;
  return newlines + FIRST_LINE;
}

// Text of one regex group, read from the source at the group's offsets (the view has the same length).
function groupText(source: string, match: RegExpMatchArray, group: number): string {
  const range = match.indices?.[group];
  return range === undefined ? '' : source.slice(range[0], range[1]);
}

export function extractSpecifiers(source: string): readonly Specifier[] {
  const view = matchingView(source);
  const staticHits = [...view.matchAll(STATIC_IMPORT)].map((match) => ({
    specifier: groupText(source, match, SPECIFIER_GROUP),
    line: lineAt(view, match.index),
    typeOnly: match[TYPE_KEYWORD_GROUP] !== undefined,
  }));
  const dynamicHits = [...view.matchAll(DYNAMIC_IMPORT)].map((match) => ({
    specifier: groupText(source, match, DYNAMIC_SPECIFIER_GROUP),
    line: lineAt(view, match.index),
    typeOnly: false,
  }));
  return [...staticHits, ...dynamicHits].sort((a, b) => a.line - b.line);
}
