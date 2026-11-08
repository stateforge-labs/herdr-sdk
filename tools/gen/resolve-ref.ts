// Role: resolves a bundle-root `$ref` (`#/schemas/<bundle>/$defs/<T>`) to its definition; other nodes resolve to themselves.
// Informs HERDR-ADR-0002 and plan section 3.2 (refs against the bundle root). Reads only; never rewrites the schema.
import type { ApiSchema, JSONSchema } from './schema.ts';
import { SCHEMA_KEY } from './schema.ts';

const REF_PREFIX = '#/schemas/';
const REF_DEFS_SEGMENT = SCHEMA_KEY.defs;
const REF_SEPARATOR = '/';
const BUNDLE_INDEX = 0;
const DEF_NAME_INDEX = 2;
const REF_SEGMENT_COUNT = 3;

export interface RefParts {
  readonly bundle: string;
  readonly name: string;
}

// Splits `#/schemas/<bundle>/$defs/<T>` into its bundle and definition name.
export function parseRef(ref: string): RefParts {
  if (!ref.startsWith(REF_PREFIX)) {
    throw new Error(`unsupported ref '${ref}'`);
  }
  const parts = ref.slice(REF_PREFIX.length).split(REF_SEPARATOR);
  const bundle = parts[BUNDLE_INDEX];
  const name = parts[DEF_NAME_INDEX];
  if (parts.length !== REF_SEGMENT_COUNT || bundle === undefined || name === undefined || parts[1] !== REF_DEFS_SEGMENT) {
    throw new Error(`unsupported ref '${ref}'`);
  }
  return { bundle, name };
}

export function resolveRef(schema: ApiSchema, node: JSONSchema): JSONSchema {
  if (node.$ref === undefined) {
    return node;
  }
  const { bundle, name } = parseRef(node.$ref);
  const definition = schema.schemas[bundle]?.$defs?.[name];
  if (definition === undefined) {
    throw new Error(`ref '${node.$ref}' does not resolve`);
  }
  return definition;
}
