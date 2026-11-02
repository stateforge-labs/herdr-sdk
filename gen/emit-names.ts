// Role: emits names.ts, the runtime name tables (Method, EventKind, ResultTag, AgentStatus and the rest) as as-const objects with same-named types.
// Informs HERDR-ADR-0002 and plan section 3.2 (emit-names.ts; wire.ts `as const satisfies` pattern). Values are checked against the schema.
import { CapabilityClass, EntryKey, ENTRY_CLASSES, PRESETS, PROMPT_EXTRA_METHODS, classOf } from './capabilities.ts';
import { assertUniqueKeys, constKey } from './const-key.ts';
import { methodNames } from './emit-method-table.ts';
import { ServerCapability } from './overrides.ts';
import type { ApiSchema, JSONSchema } from './schema.ts';
import { branchesOf, definitionsOf, isString, JS_TYPE, namespaceOf, SCHEMA_DEF, SCHEMA_KEY, SCHEMA_NAMESPACE } from './schema.ts';

const PATTERN_CONFLICT = 'token key patterns differ';
const AGENT_STATUS_CONFLICT = 'AgentStatus differs between bundles';
const MISSING_ENUM = 'expected a string enum';
const MISSING_CONST = 'expected a string const';

// One name table: its wire values, and the union type its satisfies clause checks against (absent when none is emitted).
interface NameTable {
  readonly name: string;
  readonly doc: string;
  readonly values: readonly string[];
  readonly unionType?: string;
}

// Every `propertyNames.pattern` anywhere in the schema, collected into one set.
function collectKeyPatterns(node: unknown, found: Set<string>): Set<string> {
  if (Array.isArray(node)) {
    node.forEach((child) => collectKeyPatterns(child, found));
  } else if (isRecord(node)) {
    const pattern = (node as JSONSchema).propertyNames?.pattern;
    if (pattern !== undefined) {
      found.add(pattern);
    }
    Object.values(node).forEach((child) => collectKeyPatterns(child, found));
  }
  return found;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === JS_TYPE.object && value !== null && !Array.isArray(value);
}

// The one key pattern of every tokens map; two different patterns are refused.
export function tokenNamePattern(schema: ApiSchema): string {
  const patterns = [...collectKeyPatterns(schema.schemas, new Set<string>())];
  const [only] = patterns;
  if (only === undefined || patterns.length !== 1) {
    throw new Error(`${PATTERN_CONFLICT}: ${patterns.join(', ')}`);
  }
  return only;
}

// The string values of an enum definition.
function enumValues(definition: JSONSchema | undefined): readonly string[] {
  const values = definition?.enum;
  if (values === undefined || !values.every(isString)) {
    throw new Error(MISSING_ENUM);
  }
  return values as readonly string[];
}

// The AgentStatus enum; it must be identical in every bundle that defines it.
function agentStatusValues(schema: ApiSchema): readonly string[] {
  const enums = Object.values(schema.schemas)
    .map((bundle) => definitionsOf(bundle)[SCHEMA_DEF.agentStatus])
    .filter((definition): definition is JSONSchema => definition !== undefined)
    .map((definition) => JSON.stringify(definition.enum));
  const first = enums[0];
  if (first === undefined || enums.some((text) => text !== first)) {
    throw new Error(AGENT_STATUS_CONFLICT);
  }
  return enumValues(definitionsOf(namespaceOf(schema, SCHEMA_NAMESPACE.request))[SCHEMA_DEF.agentStatus]);
}

// The string `const` of one property in every branch of a tagged union.
function branchConsts(union: JSONSchema | undefined, property: string): readonly string[] {
  return branchesOf(union ?? {}).map((branch) => {
    const value = branch.properties?.[property]?.const;
    if (!isString(value)) {
      throw new Error(MISSING_CONST);
    }
    return value;
  });
}

function requestDefinition(schema: ApiSchema, name: string): JSONSchema | undefined {
  return definitionsOf(namespaceOf(schema, SCHEMA_NAMESPACE.request))[name];
}

function responseResultTags(schema: ApiSchema): readonly string[] {
  const union = definitionsOf(namespaceOf(schema, SCHEMA_NAMESPACE.successResponse))[SCHEMA_DEF.responseResult];
  return branchConsts(union, SCHEMA_KEY.type);
}

export function subscriptionTypes(schema: ApiSchema): readonly string[] {
  return branchConsts(requestDefinition(schema, SCHEMA_DEF.subscription), SCHEMA_KEY.type);
}

export function eventMatchKinds(schema: ApiSchema): readonly string[] {
  return branchConsts(requestDefinition(schema, SCHEMA_DEF.eventMatch), SCHEMA_KEY.event);
}

export function eventKinds(schema: ApiSchema): readonly string[] {
  return enumValues(definitionsOf(namespaceOf(schema, SCHEMA_NAMESPACE.event))[SCHEMA_DEF.eventKind]);
}

export function subscriptionEventKinds(schema: ApiSchema): readonly string[] {
  return enumValues(definitionsOf(namespaceOf(schema, SCHEMA_NAMESPACE.subscriptionEvent))[SCHEMA_DEF.subscriptionEventKind]);
}

// Method names of the given capability classes, sorted, with any extra names added.
function methodsOfClasses(
  schema: ApiSchema,
  classes: readonly CapabilityClass[],
  extra: readonly string[],
): readonly string[] {
  const picked = methodNames(schema).filter((name) => classes.includes(classOf(name)));
  return [...new Set([...picked, ...extra])].sort();
}

// The extra methods that join one entry point (agent.prompt joins the prompt entry).
function extraMethodsOf(key: string): readonly string[] {
  return key === EntryKey.Prompt ? PROMPT_EXTRA_METHODS : [];
}

// Every entry point expanded to its sorted method names.
export function entryMethods(schema: ApiSchema): readonly (readonly [string, readonly string[]])[] {
  return Object.entries(ENTRY_CLASSES).map(([key, classes]) => [key, methodsOfClasses(schema, classes, extraMethodsOf(key))] as const);
}

function readOnlyMethods(schema: ApiSchema): ReadonlySet<string> {
  const readOnly = entryMethods(schema).find(([key]) => key === EntryKey.ReadOnly);
  return new Set(readOnly?.[1] ?? []);
}

// Every preset method must be in the readOnly entry; a wider preset is refused.
export function presetMethods(schema: ApiSchema): readonly (readonly [string, readonly string[]])[] {
  const readOnly = readOnlyMethods(schema);
  return Object.entries(PRESETS).map(([preset, methods]) => {
    for (const method of methods) {
      if (!readOnly.has(method)) {
        throw new Error(`preset '${preset}' method '${method}' is not in the readOnly entry`);
      }
    }
    return [preset, methods] as const;
  });
}

// One `as const` object: keys are constKey(value), values the wire strings. Checked against the union type when one is named.
function renderTable(table: NameTable): string {
  assertUniqueKeys(table.values);
  const pairs = table.values.map((value) => `  ${constKey(value)}: ${JSON.stringify(value)},`).join('\n');
  const check = table.unionType === undefined ? '' : ` satisfies Record<string, ${table.unionType}>`;
  const type = table.unionType ?? `(typeof ${table.name})[keyof typeof ${table.name}]`;
  return `/** ${table.doc} */\nexport const ${table.name} = {\n${pairs}\n} as const${check};\nexport type ${table.name} = ${type};`;
}

function renderMembers(name: string, lists: readonly (readonly [string, readonly string[]])[]): string {
  const body = lists.map(([key, methods]) => `  ${JSON.stringify(key)}: ${JSON.stringify(methods)},`).join('\n');
  return `export const ${name} = {\n${body}\n} as const;`;
}

export function emitNames(schema: ApiSchema, banner: string): string {
  const tables: readonly NameTable[] = [
    { name: 'Method', doc: 'Every wire method name.', values: methodNames(schema), unionType: 'MethodName' },
    { name: 'EventKind', doc: 'Event kinds (lifecycle events and the awaitable kinds).', values: eventKinds(schema), unionType: 'EventKindName' },
    {
      name: 'SubscriptionEventKind',
      doc: 'Kinds carried by a subscription_event frame.',
      values: subscriptionEventKinds(schema),
      unionType: 'SubscriptionEventKindName',
    },
    { name: 'ResultTag', doc: 'Response tags.', values: responseResultTags(schema), unionType: 'ResultTagName' },
    { name: 'AgentStatus', doc: 'Agent status values.', values: agentStatusValues(schema), unionType: 'AgentStatusName' },
    { name: 'SubscriptionType', doc: 'Subscription type names.', values: subscriptionTypes(schema) },
    { name: 'EventMatchKind', doc: 'EventMatch kind names.', values: eventMatchKinds(schema) },
    { name: 'CapabilityClass', doc: 'Capability classes (plan 4).', values: Object.values(CapabilityClass) },
    { name: 'ServerCapability', doc: 'ServerCapabilities keys that gate a method.', values: Object.values(ServerCapability) },
  ];
  const blocks = [
    ...tables.map(renderTable),
    `/** Token key pattern, shared by every tokens map (plan 3.2). */\nexport const TOKEN_NAME_PATTERN = ${JSON.stringify(tokenNamePattern(schema))} as const;`,
    `/** Method names per entry point, sorted; the class sets are in gen/capabilities.ts. */\n${renderMembers('ENTRY_METHODS', entryMethods(schema))}`,
    `/** Method names per named preset. */\n${renderMembers('PRESET_METHODS', presetMethods(schema))}`,
  ];
  return `${banner}
import type { Method as MethodName } from './methods.ts';
import type { AgentStatus as AgentStatusName, EventKind as EventKindName, SubscriptionEventKind as SubscriptionEventKindName } from './events.ts';
import type { ResultTag as ResultTagName } from './results.ts';

${blocks.join('\n\n')}
`;
}
