// Role: emits names/, the runtime name tables (Method with one constant per method, EventKind, ResultTag, AgentStatus and the rest) as as-const objects with same-named types.
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

// One name table: its wire values, the file it is written to under names/, and the union type its satisfies clause checks against.
interface NameTable {
  readonly file: string;
  readonly name: string;
  readonly doc: string;
  readonly values: readonly string[];
  readonly union?: { readonly type: string; readonly from: string };
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
  const check = table.union === undefined ? '' : ` satisfies Record<string, ${table.union.type}>`;
  const type = table.union?.type ?? `(typeof ${table.name})[keyof typeof ${table.name}]`;
  return `/** ${table.doc} */\nexport const ${table.name} = {\n${pairs}\n} as const${check};\nexport type ${table.name} = ${type};`;
}

// One standalone constant per method name (`MethodEventsSubscribe`), so library code imports only the names it uses.
function renderMethodConstants(methods: readonly string[]): string {
  assertUniqueKeys(methods);
  return methods.map((name) => `export const Method${constKey(name)} = ${JSON.stringify(name)} as const;`).join('\n');
}

function methodFile(schema: ApiSchema, banner: string): string {
  const methods = methodNames(schema);
  const pairs = methods.map((name) => `  ${constKey(name)}: Method${constKey(name)},`).join('\n');
  return `${banner}
import type { MethodName } from '../method-table.ts';

${renderMethodConstants(methods)}

/** Every wire method name. */
export const Method = {
${pairs}
} as const satisfies Record<string, MethodName>;
export type Method = MethodName;
`;
}

// The name tables, one file each under names/ (the method table is separate: see methodFile).
function nameTables(schema: ApiSchema): readonly NameTable[] {
  return [
    { file: 'event-kind.ts', name: 'EventKind', doc: 'Event kinds (lifecycle events and the awaitable kinds).', values: eventKinds(schema), union: { type: 'EventKindName', from: '../events.ts' } },
    { file: 'subscription-event-kind.ts', name: 'SubscriptionEventKind', doc: 'Kinds carried by a subscription_event frame.', values: subscriptionEventKinds(schema), union: { type: 'SubscriptionEventKindName', from: '../events.ts' } },
    { file: 'result-tag.ts', name: 'ResultTag', doc: 'Response tags.', values: responseResultTags(schema), union: { type: 'ResultTagName', from: '../results.ts' } },
    { file: 'agent-status.ts', name: 'AgentStatus', doc: 'Agent status values.', values: agentStatusValues(schema), union: { type: 'AgentStatusName', from: '../events.ts' } },
    { file: 'subscription-type.ts', name: 'SubscriptionType', doc: 'Subscription type names.', values: subscriptionTypes(schema) },
    { file: 'event-match-kind.ts', name: 'EventMatchKind', doc: 'EventMatch kind names.', values: eventMatchKinds(schema) },
    { file: 'capability-class.ts', name: 'CapabilityClass', doc: 'Capability classes (plan 4).', values: Object.values(CapabilityClass) },
    { file: 'server-capability.ts', name: 'ServerCapability', doc: 'ServerCapabilities keys that gate a method.', values: Object.values(ServerCapability) },
  ];
}

// The type imports a name file needs for its satisfies clauses, one line per source module.
function typeImports(tables: readonly NameTable[]): string {
  const byFrom = new Map<string, string[]>();
  for (const table of tables) {
    if (table.union !== undefined) {
      byFrom.set(table.union.from, [...(byFrom.get(table.union.from) ?? []), table.union.type]);
    }
  }
  return [...byFrom].map(([from, types]) => `import type { ${types.map((type) => `${type.replace(/Name$/, '')} as ${type}`).join(', ')} } from '${from}';`).join('\n');
}

// Each name table is its own module under names/, with a barrel that re-exports them all.
export function emitNameFiles(schema: ApiSchema, banner: string): Readonly<Record<string, string>> {
  const tables = nameTables(schema);
  const files: Record<string, string> = { 'names/method.ts': methodFile(schema, banner) };
  for (const table of tables) {
    const imports = table.union === undefined ? '' : `${typeImports([table])}\n\n`;
    files[`names/${table.file}`] = `${banner}\n${imports}${renderTable(table)}\n`;
  }
  files['names/token-name-pattern.ts'] = `${banner}\n/** Token key pattern, shared by every tokens map (plan 3.2). */\nexport const TOKEN_NAME_PATTERN = ${JSON.stringify(tokenNamePattern(schema))} as const;\n`;
  const barrel = ['method.ts', ...tables.map((table) => table.file), 'token-name-pattern.ts'];
  files['names/index.ts'] = `${banner}\n${barrel.map((file) => `export * from './${file}';`).join('\n')}\n`;
  return files;
}
