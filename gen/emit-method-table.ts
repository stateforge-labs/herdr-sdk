// Role: emits method-table.ts, the one METHODS table (name, class, result tag, namespace path, long-poll flag) and the MethodName union; no second method list.
// Informs HERDR-ADR-0002 and plan section 3.2 (emit-method-table.ts: one table). Result tags come from METHOD_RESULT_MAP (null for a LOOSE row).
import { classOf, type CapabilityClass } from './capabilities.ts';
import { METHOD_RESULT_MAP, RESULT_KIND } from './method-result-map.ts';
import { isLongPoll } from './overrides.ts';
import type { ApiSchema, JSONSchema } from './schema.ts';
import { branchesOf, constOf, requestNamespace, SCHEMA_KEY } from './schema.ts';

export interface MethodRow {
  readonly name: string;
  readonly class: CapabilityClass;
  readonly result: string | null;
  readonly ns: readonly string[];
  readonly longPoll: boolean;
}

const NAME_SEPARATOR = '.';
const ROW_TYPE = '{ name: string; class: CapabilityClass; result: ResultTag | null; ns: readonly string[]; longPoll: boolean }';

// Namespace path of a method: every segment but the last ('pane.selection.read' -> ['pane', 'selection']).
export function namespaceOf(name: string): readonly string[] {
  return name.split(NAME_SEPARATOR).slice(0, -1);
}

function assertUnique(names: readonly string[]): void {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) {
      throw new Error(`duplicate method '${name}' in the schema`);
    }
    seen.add(name);
  }
}

export function methodNames(schema: ApiSchema): readonly string[] {
  const names = branchesOf(requestNamespace(schema)).map((branch: JSONSchema) => constOf(branch, SCHEMA_KEY.method));
  assertUnique(names);
  return names;
}

// Result tag from the map; null for a LOOSE row (a method that answers several tags).
function resultOf(name: string): string | null {
  const row = Object.hasOwn(METHOD_RESULT_MAP, name) ? METHOD_RESULT_MAP[name] : undefined;
  return row?.kind === RESULT_KIND.typed ? row.tag : null;
}

export function methodRows(schema: ApiSchema): readonly MethodRow[] {
  return methodNames(schema).map((name) => ({
    name,
    class: classOf(name),
    result: resultOf(name),
    ns: namespaceOf(name),
    longPoll: isLongPoll(name),
  }));
}

function renderRow(row: MethodRow): string {
  const fields = [
    `name: ${JSON.stringify(row.name)}`,
    `class: ${JSON.stringify(row.class)}`,
    `result: ${JSON.stringify(row.result)}`,
    `ns: ${JSON.stringify(row.ns)}`,
    `longPoll: ${JSON.stringify(row.longPoll)}`,
  ];
  return `  { ${fields.join(', ')} },`;
}

export function emitMethodTable(schema: ApiSchema, banner: string): string {
  const rows = methodRows(schema);
  return `${banner}
import type { CapabilityClass } from './names/capability-class.ts';
import type { ResultTag } from './results.ts';

export const METHODS = [
${rows.map(renderRow).join('\n')}
] as const satisfies readonly ${ROW_TYPE}[];

/** Every wire method name, as the METHODS table spells it. Method (names/method.ts) is this union. */
export type MethodName = (typeof METHODS)[number]["name"];
`;
}
