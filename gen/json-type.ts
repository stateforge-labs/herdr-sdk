// Role: JSON Schema type names as constants, and the type kinds a schema node declares.
// Informs HERDR-ADR-0002 and plan section 3.2 (ts-type.ts port). Comparisons go through JSON_TYPE, never a literal.
import { isString } from './schema.ts';
import type { JSONSchema } from './schema.ts';

export const JSON_TYPE = {
  string: 'string',
  integer: 'integer',
  number: 'number',
  boolean: 'boolean',
  null: 'null',
  array: 'array',
  object: 'object',
} as const;

// Schema `format` values with a meaning for the generated types.
export const FORMAT = { uint64: 'uint64' } as const;

// The type kinds a node declares: `type` is one name or a list (nullable types are `[kind, "null"]`).
export function kindsOf(schema: JSONSchema): readonly string[] {
  const type = schema.type;
  if (Array.isArray(type)) {
    return type;
  }
  return isString(type) ? [type] : [];
}
