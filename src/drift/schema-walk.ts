// Role: pure readers of a schema document: a bundle, its definitions, the branches of a tagged union and a string const.
// Informs HERDR-ADR-0009 (drift names come from the schema). Re-implements the minimal walk of atalaya's tools/gen/schema.ts, because Layer.Drift may not import tools/gen/ (tools/rules/layers.ts).
import { JsType, SchemaField, SchemaKey } from './constants.ts';
import { MalformedSchemaError } from './malformed-schema-error.ts';
import type { SchemaDocument } from './types.ts';

export type SchemaNode = Readonly<Record<string, unknown>>;

export function isNode(value: unknown): value is SchemaNode {
  return typeof value === JsType.Object && value !== null;
}

// TypeScript narrows typeof only against a literal, so the scalar checks go through these guards.
export function isString(value: unknown): value is string {
  return typeof value === JsType.String;
}

export function isNumber(value: unknown): value is number {
  return typeof value === JsType.Number;
}

export function namespaceOf(schema: SchemaDocument, name: string): SchemaNode {
  const schemas = schema[SchemaField.Schemas];
  const found = isNode(schemas) ? schemas[name] : undefined;
  if (!isNode(found)) {
    throw new MalformedSchemaError(`the schema carries no '${name}' namespace`);
  }
  return found;
}

export function definitionsOf(namespace: SchemaNode): SchemaNode {
  const defs = namespace[SchemaKey.Defs];
  return isNode(defs) ? defs : {};
}

export function definitionNamed(namespace: SchemaNode, name: string): SchemaNode {
  const found = definitionsOf(namespace)[name];
  if (!isNode(found)) {
    throw new MalformedSchemaError(`the schema carries no '${name}' definition`);
  }
  return found;
}

export function branchesOf(node: SchemaNode): readonly SchemaNode[] {
  const branches = node[SchemaKey.OneOf];
  if (!Array.isArray(branches)) {
    throw new MalformedSchemaError('a tagged union carries no oneOf branches');
  }
  return branches.filter(isNode);
}

export function constOf(node: SchemaNode, property: string): string {
  const properties = node[SchemaKey.Properties];
  const field = isNode(properties) ? properties[property] : undefined;
  const value = isNode(field) ? field[SchemaKey.Const] : undefined;
  if (!isString(value)) {
    throw new MalformedSchemaError(`a branch carries no string const at '${property}'`);
  }
  return value;
}
