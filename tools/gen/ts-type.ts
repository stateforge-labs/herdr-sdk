// Role: JSON Schema node -> TypeScript type text (refs, unions, objects, maps, nullable arrays), and the named definitions.
// Informs HERDR-ADR-0002 and plan section 3.2 (ported from atalaya-bridge 097adfd gen/ts-type.ts; wire shapes are plain erased types).
import { schemaDoc } from './doc-comment.ts';
import { JSON_TYPE, kindsOf } from './json-type.ts';
import { JS_TYPE } from './schema.ts';
import type { JSONSchema } from './schema.ts';

// A map-valued additionalProperties (a schema object), as opposed to the boolean forms.
function isSchemaMap(value: boolean | JSONSchema | undefined): value is JSONSchema {
  return typeof value === JS_TYPE.object && value !== null;
}

// Output spellings of the TypeScript types and separators this module writes.
const TS_TYPE = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  null: 'null',
  unknown: 'unknown',
  neverRecord: 'Record<string, never>',
} as const;

const REF_SEPARATOR = '/';
const UNION_SEPARATOR = ' | ';
const INTERSECTION_SEPARATOR = ' & ';
const OPTIONAL_MARK = '?';
const INDEX_SIGNATURE_KEY = '[key: string]';
const NO_TEXT = '';

function hasText(text: string): boolean {
  return text.length > 0;
}

export function refName(ref: string): string {
  return ref.split(REF_SEPARATOR).at(-1) ?? ref;
}

function unionOf(members: readonly JSONSchema[], separator: string): string {
  return members.map((member) => `(${tsType(member)})`).join(separator);
}

function scalar(kind: string, schema: JSONSchema): string {
  switch (kind) {
    case JSON_TYPE.string:
      return TS_TYPE.string;
    case JSON_TYPE.integer:
    case JSON_TYPE.number:
      return TS_TYPE.number;
    case JSON_TYPE.boolean:
      return TS_TYPE.boolean;
    case JSON_TYPE.null:
      return TS_TYPE.null;
    case JSON_TYPE.array:
      return `Array<${schema.items === undefined ? TS_TYPE.unknown : tsType(schema.items)}>`;
    case JSON_TYPE.object:
      return objectType(schema);
    default:
      return TS_TYPE.unknown;
  }
}

export function tsType(schema: JSONSchema): string {
  if (schema.$ref !== undefined) {
    return refName(schema.$ref);
  }
  if (schema.const !== undefined) {
    return JSON.stringify(schema.const);
  }
  if (schema.enum !== undefined) {
    return schema.enum.map((value) => JSON.stringify(value)).join(UNION_SEPARATOR);
  }
  if (schema.oneOf !== undefined) {
    return unionOf(schema.oneOf, UNION_SEPARATOR);
  }
  if (schema.anyOf !== undefined) {
    return unionOf(schema.anyOf, UNION_SEPARATOR);
  }
  if (schema.allOf !== undefined) {
    return unionOf(schema.allOf, INTERSECTION_SEPARATOR);
  }
  const kinds = kindsOf(schema);
  if (kinds.length === 0) {
    return schema.properties === undefined ? TS_TYPE.unknown : objectType(schema);
  }
  return kinds.map((kind) => scalar(kind, schema)).join(UNION_SEPARATOR);
}

// A field's doc comment, followed by a space so it sits in front of the field name; empty when there is no note.
function fieldDoc(schema: JSONSchema): string {
  const doc = schemaDoc(schema);
  return hasText(doc) ? `${doc} ` : NO_TEXT;
}

export function objectType(schema: JSONSchema): string {
  const properties = schema.properties ?? {};
  const required = new Set<string>(schema.required ?? []);
  const fields = Object.entries(properties).map(([name, value]) => {
    const optional = required.has(name) ? '' : OPTIONAL_MARK;
    return `${fieldDoc(value)}${JSON.stringify(name)}${optional}: ${tsType(value)};`;
  });
  const extra = schema.additionalProperties;
  const rest = isSchemaMap(extra) ? `${INDEX_SIGNATURE_KEY}: ${tsType(extra)};` : NO_TEXT;
  const all = hasText(rest) ? [...fields, rest] : fields;
  return all.length === 0 ? TS_TYPE.neverRecord : `{ ${all.join(' ')} }`;
}

function definitionBlock(name: string, definition: JSONSchema): string {
  const doc = schemaDoc(definition);
  const lead = hasText(doc) ? `${doc}\n` : NO_TEXT;
  return `${lead}export type ${name} = ${tsType(definition)};`;
}

// Named type declarations for a set of $defs; `skip` leaves out names the caller emits itself.
export function emitDefs(
  definitions: Readonly<Record<string, JSONSchema>>,
  skip: ReadonlySet<string> = new Set<string>(),
): string {
  return Object.entries(definitions)
    .filter(([name]) => !skip.has(name))
    .map(([name, definition]) => definitionBlock(name, definition))
    .join('\n\n');
}
