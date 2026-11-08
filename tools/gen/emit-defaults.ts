// Role: emits defaults.ts, one smallest schema-valid result per response tag (instance generator over the result schema).
// Informs HERDR-ADR-0008 (test kit defaults) and plan section 3.2 (emit-defaults.ts). The satisfies clause is the typecheck gate.
import { resolveRef } from './resolve-ref.ts';
import { isString, JSON_KIND, namespaceOf, SCHEMA_DEF, SCHEMA_NAMESPACE } from './schema.ts';
import type { ApiSchema, JSONSchema } from './schema.ts';
import { kindsOf } from './json-type.ts';

// JSON value a default can take. Only what the generator emits: literals, arrays and plain objects.
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

// Fixed values for the scalar kinds; a string with a format or pattern gets the placeholder.
export const DEFAULT_VALUE = {
  placeholder: 'default',
  text: '',
  count: 0,
  flag: false,
} as const;

const NO_DEFAULT = 'no default for a schema node';

// The JSON Schema `true` (any value) is written as a bare boolean in a few properties; the smallest value for it is null.
const ANY_SCHEMA = true;

// The first member of an enum, or null for an empty enum.
function firstEnumValue(node: JSONSchema): JsonValue {
  const [first] = node.enum ?? [];
  return (first ?? null) as JsonValue;
}

// Instance of a property list: required keys only, in sorted key order. Undefined when a required key recurses.
function objectInstance(schema: ApiSchema, node: JSONSchema, active: ReadonlySet<string>): JsonValue | undefined {
  const required = [...(node.required ?? [])].sort();
  const result: Record<string, JsonValue> = {};
  for (const key of required) {
    const property = node.properties?.[key];
    const value = property === undefined ? undefined : instanceOf(schema, property, active);
    if (value === undefined) {
      return undefined;
    }
    result[key] = value;
  }
  return result;
}

// The scalar or container value for the first declared kind of a node.
function kindInstance(schema: ApiSchema, node: JSONSchema, kind: string, active: ReadonlySet<string>): JsonValue | undefined {
  switch (kind) {
    case JSON_KIND.object:
      return objectInstance(schema, node, active);
    case JSON_KIND.array:
      return [];
    case JSON_KIND.string:
      return node.format !== undefined || node.pattern !== undefined ? DEFAULT_VALUE.placeholder : DEFAULT_VALUE.text;
    case JSON_KIND.integer:
    case JSON_KIND.number:
      return DEFAULT_VALUE.count;
    case JSON_KIND.boolean:
      return DEFAULT_VALUE.flag;
    default:
      return null;
  }
}

// The first branch of a oneOf/anyOf whose expansion does not recurse.
function branchInstance(schema: ApiSchema, branches: readonly JSONSchema[], active: ReadonlySet<string>): JsonValue | undefined {
  for (const branch of branches) {
    const value = instanceOf(schema, branch, active);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

// Smallest valid instance of a schema node. A ref already on the current path is recursion and yields undefined.
export function instanceOf(schema: ApiSchema, node: JSONSchema, active: ReadonlySet<string> = new Set<string>()): JsonValue | undefined {
  if ((node as unknown) === ANY_SCHEMA) {
    return null;
  }
  if (node.$ref !== undefined) {
    if (active.has(node.$ref)) {
      return undefined;
    }
    return instanceOf(schema, resolveRef(schema, node), new Set([...active, node.$ref]));
  }
  if (node.const !== undefined) {
    return node.const as JsonValue;
  }
  if (node.enum !== undefined) {
    return firstEnumValue(node);
  }
  const kinds = kindsOf(node);
  if (kinds.includes(JSON_KIND.null)) {
    return null;
  }
  const [kind] = kinds;
  if (kind !== undefined) {
    return kindInstance(schema, node, kind, active);
  }
  if (node.oneOf !== undefined) {
    return branchInstance(schema, node.oneOf, active);
  }
  if (node.anyOf !== undefined) {
    return branchInstance(schema, node.anyOf, active);
  }
  if (node.properties !== undefined) {
    return objectInstance(schema, node, active);
  }
  // An unconstrained node (`{}`) accepts any value; its smallest instance is null.
  return null;
}

// One default per response tag: the result branch whose `type` is the tag.
export function defaultsByTag(schema: ApiSchema): Readonly<Record<string, JsonValue>> {
  const union = namespaceOf(schema, SCHEMA_NAMESPACE.successResponse).$defs?.[SCHEMA_DEF.responseResult];
  const defaults: Record<string, JsonValue> = {};
  for (const branch of union?.oneOf ?? []) {
    const tag = branch.properties?.type?.const;
    const value = instanceOf(schema, branch);
    if (!isString(tag) || value === undefined) {
      throw new Error(NO_DEFAULT);
    }
    defaults[tag] = value;
  }
  return defaults;
}

export function emitDefaults(schema: ApiSchema, banner: string): string {
  return `${banner}
import type { ResultByTag } from '../results.ts';

/**
 * One schema-valid result per response tag, built from the result schema. Strings with a format or pattern hold the
 * placeholder "${DEFAULT_VALUE.placeholder}". The satisfies clause makes bun run typecheck fail when a default does not match its type.
 * No \`as const\`: a readonly array would not satisfy the mutable array types in results.ts.
 */
export const DEFAULT_RESULT = ${JSON.stringify(defaultsByTag(schema), null, 2)} satisfies { [T in keyof ResultByTag]: ResultByTag[T] };
`;
}
