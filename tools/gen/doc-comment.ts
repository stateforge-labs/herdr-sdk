// Role: JSDoc text for emitted types: descriptions, and the schema keywords TypeScript cannot express (default, uint64, key patterns).
// Informs HERDR-ADR-0002 and plan section 3.2 (doc comments for propertyNames, default and uint64).
import { FORMAT } from './json-type.ts';
import type { JSONSchema } from './schema.ts';

const NOTE = {
  defaultTag: '@default',
  keysMatch: 'keys match',
  uint64: 'uint64: values above 2^53 lose precision',
} as const;

// A comment cannot contain its own terminator, and a line break would split the one-line field docs.
const COMMENT_CLOSE = '*/';
const ESCAPED_CLOSE = '* /';
const LINE_BREAK = '\n';
const SPACE = ' ';

function cleanLine(line: string): string {
  return line.split(LINE_BREAK).join(SPACE).split(COMMENT_CLOSE).join(ESCAPED_CLOSE);
}

// One JSDoc block on one line; an empty list gives no comment at all.
export function docComment(lines: readonly string[]): string {
  if (lines.length === 0) {
    return '';
  }
  return `/** ${lines.map(cleanLine).join(SPACE)} */`;
}

// The notes a schema node contributes, in a fixed order: description, default, key pattern, uint64.
export function schemaNotes(schema: JSONSchema): readonly string[] {
  const notes: string[] = [];
  if (schema.description !== undefined) {
    notes.push(schema.description);
  }
  if (schema.default !== undefined) {
    notes.push(`${NOTE.defaultTag} ${JSON.stringify(schema.default)}`);
  }
  const pattern = schema.propertyNames?.pattern;
  if (pattern !== undefined) {
    notes.push(`${NOTE.keysMatch} ${pattern}`);
  }
  if (schema.format === FORMAT.uint64) {
    notes.push(NOTE.uint64);
  }
  return notes;
}

export function schemaDoc(schema: JSONSchema): string {
  return docComment(schemaNotes(schema));
}
