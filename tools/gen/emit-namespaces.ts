// Role: emits namespaces.ts, the nested client types per entry point (type-only; no runtime tree).
// Informs HERDR-ADR-0005 (flat per-class output) and plan sections 3.2, 3.4 and 3.6 (long-poll timeouts, held).
import { EntryKey } from './capabilities.ts';
import { entryMethods, presetMethods } from './emit-names.ts';
import { methodRows } from './emit-method-table.ts';
import type { MethodRow } from './emit-method-table.ts';
import { OVERRIDES } from './overrides.ts';
import type { Override } from './overrides.ts';
import type { ApiSchema } from './schema.ts';
import { definitionsOf, methodParamsName, namespaceOf, SCHEMA_NAMESPACE } from './schema.ts';

const TIMEOUT_FIELD = 'timeout_ms';
const TIMEOUT_TYPE = 'number';
const ROOT_REF = 'P.';
const RESULT_TYPE = 'ResultByTag';
const UNMAPPED_NOTE = 'result unmapped until phase 3 (plan 4.2)';
const SUBSCRIPTION_NOTE = 'returns a Subscription (phase 4a)';
const LONG_POLL_NOTE = 'rpc timeout = timeout_ms + LONG_POLL_MARGIN_MS';
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const SEGMENT_SEPARATOR = '.';

// Interface name per entry point, and the preset's interface name.
const INTERFACE_OF: Readonly<Record<string, string>> = {
  [EntryKey.ReadOnly]: 'ReadOnlyNamespaces',
  [EntryKey.ReadOnlyContent]: 'ReadOnlyContentNamespaces',
  [EntryKey.Prompt]: 'PromptNamespaces',
  [EntryKey.Client]: 'ClientNamespaces',
  [EntryKey.Admin]: 'AdminNamespaces',
  [EntryKey.Held]: 'HeldNamespaces',
};

// The interface name of an entry point; an entry without a name is a bug in this file.
function interfaceOf(key: string): string {
  const name = INTERFACE_OF[key];
  if (name === undefined) {
    throw new Error(`entry '${key}' has no namespace interface`);
  }
  return name;
}

// `timeout_ms` required at the top of the params: `Omit<P.X, "timeout_ms"> & { timeout_ms: number }`.
function requiredAtTop(params: string, field: string): string {
  return `Omit<${ROOT_REF}${params}, ${JSON.stringify(field)}> & { ${field}: ${TIMEOUT_TYPE} }`;
}

// `timeout_ms` required one level down, inside an optional wrapper such as `wait` (agent.prompt).
function requiredInNested(params: string, wrapper: string, nested: string): string {
  const inner = `Omit<${ROOT_REF}${nested}, ${JSON.stringify(TIMEOUT_FIELD)}> & { ${TIMEOUT_FIELD}: ${TIMEOUT_TYPE} }`;
  return `Omit<${ROOT_REF}${params}, ${JSON.stringify(wrapper)}> & { ${wrapper}?: ${inner} }`;
}

// The params type of one method, with the long-poll timeout made required when the override says so.
function paramsTypeOf(schema: ApiSchema, method: string, override: Override | undefined): string {
  const name = methodParamsName(schema, method);
  const path = override?.requiredTimeoutPath;
  if (path === undefined) {
    return `${ROOT_REF}${name}`;
  }
  if (path.length === 1) {
    return requiredAtTop(name, path[0] ?? TIMEOUT_FIELD);
  }
  const nested = override?.nestedTypes?.[0];
  if (path.length !== 2 || nested === undefined || path[1] !== TIMEOUT_FIELD) {
    throw new Error(`unsupported long-poll path for '${method}'`);
  }
  return requiredInNested(name, path[0] ?? '', nested);
}

// Params are optional only when the schema has no required key and the method has no forced timeout.
function paramsOptional(schema: ApiSchema, method: string, override: Override | undefined): boolean {
  const params = definitionsOf(namespaceOf(schema, SCHEMA_NAMESPACE.request))[methodParamsName(schema, method)];
  const required: readonly string[] = params?.required ?? [];
  return required.length === 0 && override?.requiredTimeoutPath === undefined;
}

// The JSDoc line of one member: class, long-poll, unmapped result, stream return and gate.
function memberDoc(row: MethodRow, override: Override | undefined): string {
  const notes = [`class ${row.class}`];
  if (row.longPoll) {
    notes.push(LONG_POLL_NOTE);
  }
  if (row.result === null) {
    notes.push(UNMAPPED_NOTE);
  }
  if (override?.returns !== undefined) {
    notes.push(SUBSCRIPTION_NOTE);
  }
  if (override?.capability !== undefined) {
    notes.push(`gated on ${override.capability}`);
  }
  return `/** ${notes.join('; ')}. */`;
}

// The result type of one method: a mapped tag, or unknown while unmapped or streaming.
function resultTypeOf(row: MethodRow, override: Override | undefined): string {
  if (row.result === null || override?.returns !== undefined) {
    return 'unknown';
  }
  return `${RESULT_TYPE}[${JSON.stringify(row.result)}]`;
}

// Property key text: an identifier stays bare; any other wire segment is quoted and never renamed.
function keyText(segment: string): string {
  return IDENTIFIER.test(segment) ? segment : JSON.stringify(segment);
}

function memberLine(schema: ApiSchema, row: MethodRow, indent: string): string {
  const override = OVERRIDES[row.name];
  const params = paramsTypeOf(schema, row.name, override);
  const optional = paramsOptional(schema, row.name, override) ? '?' : '';
  const leaf = row.name.split(SEGMENT_SEPARATOR).at(-1) ?? row.name;
  const signature = `${keyText(leaf)}(params${optional}: ${params}, options?: CallOptions): Promise<${resultTypeOf(row, override)}>;`;
  return `${indent}${memberDoc(row, override)}\n${indent}${signature}`;
}

// Renders one level of a namespace tree: leaves for methods ending here, nested objects for longer names.
function renderLevel(schema: ApiSchema, rows: readonly MethodRow[], depth: number, indent: string): string {
  const leaves = rows.filter((row) => row.name.split(SEGMENT_SEPARATOR).length === depth + 1);
  const branchKeys = [...new Set(rows
    .filter((row) => row.name.split(SEGMENT_SEPARATOR).length > depth + 1)
    .map((row) => row.name.split(SEGMENT_SEPARATOR)[depth] ?? ''))].sort();
  const leafLines = leaves
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((row) => memberLine(schema, row, indent));
  const branchLines = branchKeys.map((key) => {
    const below = rows.filter((row) => (row.name.split(SEGMENT_SEPARATOR)[depth] ?? '') === key && row.name.split(SEGMENT_SEPARATOR).length > depth + 1);
    return `${indent}${keyText(key)}: {\n${renderLevel(schema, below, depth + 1, `${indent}  `)}\n${indent}};`;
  });
  return [...leafLines, ...branchLines].join('\n');
}

// One exported interface over a set of methods.
function renderInterface(schema: ApiSchema, name: string, rows: readonly MethodRow[]): string {
  return `export interface ${name} {\n${renderLevel(schema, rows, 0, '  ')}\n}`;
}

// The rows of one entry point, from its expanded method names.
function rowsOf(all: readonly MethodRow[], names: readonly string[]): readonly MethodRow[] {
  const picked = new Set(names);
  return all.filter((row) => picked.has(row.name));
}

export function emitNamespaces(schema: ApiSchema, banner: string): string {
  const all = methodRows(schema);
  const entries = entryMethods(schema).map(([key, names]) => renderInterface(schema, interfaceOf(key), rowsOf(all, names)));
  const presets = presetMethods(schema).map(([preset, names]) => renderInterface(schema, `${preset}Namespaces`, rowsOf(all, names)));
  return `${banner}
import type * as P from './params.ts';
import type { ResultByTag } from './results.ts';

/** Per-request call options: a cancel signal and a timeout in ms. */
export interface CallOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

${[...entries, ...presets].join('\n\n')}
`;
}
