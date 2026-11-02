// Role: inventoryOf(): the inventory of one schema: protocol, herdr version, the four facets by sorted name and the field shapes.
// Informs HERDR-ADR-0009 (drift compares the protocol and four facets by name) and plan 6; contract in drift/types.ts (InventoryOf).
import { SchemaDefinition, SchemaField, SchemaNamespace, TagProperty } from './constants.ts';
import { fieldShapesOf } from './field-shapes.ts';
import { MalformedSchemaError } from './malformed-schema-error.ts';
import { branchesOf, constOf, definitionNamed, isNumber, namespaceOf } from './schema-walk.ts';
import type { InventoryOf, SchemaDocument } from './types.ts';

export const inventoryOf: InventoryOf = (schema, herdrVersion) => {
  const request = namespaceOf(schema, SchemaNamespace.Request);
  const success = namespaceOf(schema, SchemaNamespace.SuccessResponse);
  const event = namespaceOf(schema, SchemaNamespace.Event);
  return {
    protocol: protocolOf(schema),
    herdrVersion,
    methods: tagsOf(branchesOf(request), TagProperty.Method),
    resultTags: tagsOf(branchesOf(definitionNamed(success, SchemaDefinition.ResponseResult)), TagProperty.Type),
    eventKinds: tagsOf(branchesOf(definitionNamed(event, SchemaDefinition.EventData)), TagProperty.Type),
    subscriptionTypes: tagsOf(branchesOf(definitionNamed(request, SchemaDefinition.Subscription)), TagProperty.Type),
    fieldShapes: fieldShapesOf(schema),
  };
};

function protocolOf(schema: SchemaDocument): number {
  const protocol = schema[SchemaField.Protocol];
  if (!isNumber(protocol)) {
    throw new MalformedSchemaError('the schema carries no protocol number');
  }
  return protocol;
}

function tagsOf(branches: readonly Readonly<Record<string, unknown>>[], property: string): string[] {
  return branches.map((branch) => constOf(branch, property)).toSorted();
}
