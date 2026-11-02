// Role: pure emitter of the METHODS table (method name and namespace path only).
// Informs HERDR-ADR-0002 and plan section 3.2 (emit-method-table.ts). Class and result columns arrive in phases 1b and 3.
import type { ApiSchema, JSONSchema } from './schema.ts';
import { branchesOf, constOf, requestNamespace, SCHEMA_KEY } from './schema.ts';

export interface MethodRow {
  readonly name: string;
  readonly ns: readonly string[];
}

const NAME_SEPARATOR = '.';
const ROW_TYPE = '{ name: string; ns: readonly string[] }';

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

export function methodRows(schema: ApiSchema): readonly MethodRow[] {
  return methodNames(schema).map((name) => ({ name, ns: namespaceOf(name) }));
}

function renderRow(row: MethodRow): string {
  return `  { name: ${JSON.stringify(row.name)}, ns: ${JSON.stringify(row.ns)} },`;
}

export function emitMethodTable(schema: ApiSchema, banner: string): string {
  const rows = methodRows(schema);
  return `${banner}
export const METHODS = [
${rows.map(renderRow).join('\n')}
] as const satisfies readonly ${ROW_TYPE}[];

export type Method = (typeof METHODS)[number]["name"];
`;
}
