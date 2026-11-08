// Role: reading a schema for drift: the committed and installed sources, the walk, the inventory and its stable text.
// Informs HERDR-ADR-0009, HERDR-ADR-0008, plan 6, plan 4.2; merged by HERDR-ADR-0021 from schema-walk.ts, stable-text.ts, field-shapes.ts, schema-source.ts, inventory.ts, unmapped-methods.ts.
import { JsType, SchemaField, SchemaKey, SchemaNamespace, HerdrCommand, ReasonText, SchemaFileName, SystemErrorCode, VERSION_PATTERN, VersionFileField, SchemaDefinition, TagProperty } from './constants.ts';
import { MalformedSchemaError } from '../herdr/errors.ts';
import type { SchemaDocument, SchemaRead, SchemaSource, InventoryOf } from './types.ts';
import { join } from 'node:path';
import { SchemaReadKind } from '../constants.ts';
import { METHOD_RESULT } from '../herdr/generated/index.ts';

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

// Keywords whose value maps names to schemas: their keys are names, so a name such as `description` is kept.
const NAME_MAP_KEYWORDS: readonly string[] = [SchemaKey.Properties, SchemaKey.Defs];

export function stableText(value: unknown): string {
  return JSON.stringify(withSortedKeys(value));
}

function withSortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withSortedKeys);
  }
  if (!isNode(value)) {
    return value;
  }
  const keys = Object.keys(value).filter((key) => key !== SchemaKey.Description).toSorted();
  return Object.fromEntries(keys.map((key) => [key, valueUnder(key, value[key])]));
}

// A child of a name map is a schema whose keys are names too; sorting keeps the same text for the same shape.
function valueUnder(key: string, child: unknown): unknown {
  return NAME_MAP_KEYWORDS.includes(key) && isNode(child) ? namesOf(child) : withSortedKeys(child);
}

function namesOf(map: Readonly<Record<string, unknown>>): unknown {
  return Object.fromEntries(Object.keys(map).toSorted().map((name) => [name, withSortedKeys(map[name])]));
}

export function fieldShapesOf(schema: SchemaDocument): Record<string, string> {
  const shapes: Record<string, string> = {};
  for (const bundle of [SchemaNamespace.Request, SchemaNamespace.SuccessResponse]) {
    for (const [name, node] of Object.entries(definitionsOf(namespaceOf(schema, bundle)))) {
      shapes[`${bundle}.${name}`] = stableText(node);
    }
  }
  return shapes;
}

// Reads one file as text; throws when it is absent.
export type ReadText = (path: string) => string;

// Runs the herdr CLI with arguments and returns its stdout; throws when it fails (a missing binary carries code ENOENT).
export type RunHerdr = (args: readonly string[]) => string;

export function committedSource(dir: string, readText: ReadText): SchemaSource {
  return async () => {
    let schemaText: string;
    let versionText: string;
    try {
      schemaText = readText(join(dir, SchemaFileName.Schema));
    } catch (error) {
      return readFailure(error, ReasonText.CommittedMissing, ReasonText.CommittedUnreadable);
    }
    try {
      versionText = readText(join(dir, SchemaFileName.Version));
    } catch (error) {
      return readFailure(error, ReasonText.VersionMissing, ReasonText.VersionFileUnreadable);
    }
    const version = committedVersionOf(versionText);
    return version === null ? unreadable(ReasonText.VersionUnreadable) : parseSchemaText(schemaText, version);
  };
}

export function installedSource(runHerdr: RunHerdr): SchemaSource {
  return async () => {
    let schemaText: string;
    let versionText: string;
    try {
      schemaText = runHerdr(HerdrCommand.SchemaJson);
    } catch (error) {
      return readFailure(error, ReasonText.HerdrMissing, ReasonText.HerdrRefused);
    }
    try {
      versionText = runHerdr(HerdrCommand.Version);
    } catch (error) {
      return readFailure(error, ReasonText.HerdrMissing, ReasonText.HerdrVersionMissing);
    }
    const version = herdrVersionOf(versionText);
    return version === null ? unreadable(ReasonText.HerdrVersionMissing) : parseSchemaText(schemaText, version);
  };
}

// Reads schema JSON text; the herdr version comes from the caller. A schema without a protocol number is Unreadable.
export function parseSchemaText(text: string, herdrVersion: string): SchemaRead {
  const parsed = tryParse(text);
  if (parsed === undefined) {
    return unreadable(ReasonText.NotJson);
  }
  if (!isNode(parsed) || !isNumber(parsed[SchemaField.Protocol])) {
    return unreadable(ReasonText.NoProtocol);
  }
  return { kind: SchemaReadKind.Found, schema: parsed, herdrVersion };
}

// A missing file or executable (code ENOENT) is NotFound; any other failure to read is Unreadable.
function readFailure(error: unknown, missingReason: string, failedReason: string): SchemaRead {
  const code = isNode(error) ? error.code : undefined;
  return code === SystemErrorCode.NotFound ? notFound(missingReason) : unreadable(failedReason);
}

function committedVersionOf(text: string): string | null {
  const parsed = tryParse(text);
  const version = isNode(parsed) ? parsed[VersionFileField.Version] : undefined;
  return isString(version) ? version : null;
}

function herdrVersionOf(text: string): string | null {
  const match = VERSION_PATTERN.exec(text);
  return match?.[0] ?? null;
}

// JSON.parse never yields undefined, so undefined marks a text that is not JSON.
function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function notFound(reason: string): SchemaRead {
  return { kind: SchemaReadKind.NotFound, reason };
}

function unreadable(reason: string): SchemaRead {
  return { kind: SchemaReadKind.Unreadable, reason };
}

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

export function unmappedMethods(methods: readonly string[]): string[] {
  return methods.filter((method) => !Object.hasOwn(METHOD_RESULT, method)).toSorted();
}
