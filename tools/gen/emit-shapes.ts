// Role: emits shapes.ts, the top-level params shape table (required keys, field kinds, enums, token key pattern) for the test fake's request checker.
// Informs HERDR-ADR-0008 (test kit) and plan sections 3.2 and 5 (emit-shapes.ts). Data only; the checker is phase 5a.
import { constKey } from './const-key.ts';
import { methodNames } from './emit-method-table.ts';
import { resolveRef } from './resolve-ref.ts';
import { JSON_KIND, methodParamsName, namespaceOf, definitionsOf, SCHEMA_NAMESPACE } from './schema.ts';
import type { ApiSchema, JSONSchema } from './schema.ts';
import { kindsOf } from './json-type.ts';

interface FieldShape {
  readonly kinds: readonly string[];
  readonly enum?: readonly string[];
  readonly keyPattern?: string;
}

interface ParamsShape {
  readonly required: readonly string[];
  readonly fields: Readonly<Record<string, FieldShape>>;
}

// The kinds a node accepts. A $ref to an object gives ['object']; a union gives the union of its branches' kinds.
function kindsOfNode(schema: ApiSchema, node: JSONSchema): readonly string[] {
  const resolved = resolveRef(schema, node);
  const branches = [...(resolved.oneOf ?? []), ...(resolved.anyOf ?? [])];
  if (branches.length > 0) {
    return [...new Set(branches.flatMap((branch) => kindsOfNode(schema, branch)))];
  }
  const declared = kindsOf(resolved);
  if (declared.length > 0) {
    return declared;
  }
  return resolved.properties !== undefined || resolved.additionalProperties !== undefined ? [JSON_KIND.object] : [];
}

// The field shape of one property: kinds, the enum when the (resolved) node has one, and the key pattern of a map.
function fieldShapeOf(schema: ApiSchema, node: JSONSchema): FieldShape {
  const resolved = resolveRef(schema, node);
  const values = resolved.enum;
  const pattern = resolved.propertyNames?.pattern;
  return {
    kinds: kindsOfNode(schema, node),
    ...(values === undefined ? {} : { enum: values.map(String) }),
    ...(pattern === undefined ? {} : { keyPattern: pattern }),
  };
}

// The params shape of one method, from its params definition.
export function paramsShapeOf(schema: ApiSchema, method: string): ParamsShape {
  const name = methodParamsName(schema, method);
  const definition = definitionsOf(namespaceOf(schema, SCHEMA_NAMESPACE.request))[name];
  if (definition === undefined) {
    throw new Error(`params '${name}' of '${method}' is not in request.$defs`);
  }
  const fields = Object.fromEntries(
    Object.entries(definition.properties ?? {}).map(([field, node]) => [field, fieldShapeOf(schema, node)]),
  );
  return { required: definition.required ?? [], fields };
}

function renderShape(shape: ParamsShape): string {
  return JSON.stringify(shape, null, 2).split('\n').join('\n  ');
}

export function emitShapes(schema: ApiSchema, banner: string): string {
  const entries = methodNames(schema).map((method) => `  ${JSON.stringify(method)}: ${renderShape(paramsShapeOf(schema, method))},`);
  const kindLines = Object.entries(JSON_KIND).map(([key, kind]) => `  ${constKey(key)}: ${JSON.stringify(kind)},`);
  return `${banner}
import type { Method } from '../names/method.ts';

/** JSON kinds a params field may take. */
export const JsonKind = {
${kindLines.join('\n')}
} as const;
export type JsonKind = (typeof JsonKind)[keyof typeof JsonKind];

export interface FieldShape {
  readonly kinds: readonly JsonKind[];
  readonly enum?: readonly string[];
  readonly keyPattern?: string;
}

export interface ParamsShape {
  readonly required: readonly string[];
  readonly fields: Readonly<Record<string, FieldShape>>;
}

/** Top-level params shape per method (the fake's request checker reads it in phase 5a). */
export const PARAMS_SHAPE = {
${entries.join('\n')}
} as const satisfies Record<Method, ParamsShape>;
`;
}
