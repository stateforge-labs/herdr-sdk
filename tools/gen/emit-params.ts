// Role: emits params.ts, the request $defs and MethodParams (method -> params type); the method list itself lives in methods.ts.
// Informs HERDR-ADR-0002 and plan section 3.2 (ported from atalaya-bridge 097adfd gen/emit-params.ts; no second method table).
import type { ApiSchema } from './schema.ts';
import { branchesOf, constOf, definitionsOf, namespaceOf, propertyOf, SCHEMA_KEY, SCHEMA_NAMESPACE } from './schema.ts';
import { emitDefs, tsType } from './ts-type.ts';

interface MethodEntry {
  readonly method: string;
  readonly params: string;
}

export function emitParams(schema: ApiSchema, header: string): string {
  const request = namespaceOf(schema, SCHEMA_NAMESPACE.request);
  const entries: readonly MethodEntry[] = branchesOf(request).map((branch) => ({
    method: constOf(branch, SCHEMA_KEY.method),
    params: tsType(propertyOf(branch, SCHEMA_KEY.params)),
  }));
  return `${header}
import type { Method } from './names/method.ts';

${emitDefs(definitionsOf(request))}

/** Every method the server accepts, mapped to its params type. */
export interface MethodParams {
${entries.map((entry) => `  ${JSON.stringify(entry.method)}: ${entry.params};`).join('\n')}
}

/** Fails to compile when a method in methods.ts has no entry in MethodParams. */
export type MethodParamsCheck = { [M in Method]: MethodParams[M] };
`;
}
