// Role: emits errors.ts, the error_response $defs (ErrorBody).
// Informs HERDR-ADR-0002 and plan section 3.2 (ported from atalaya-bridge 097adfd gen/emit-errors.ts; bundle name from SCHEMA_NAMESPACE).
import type { ApiSchema } from './schema.ts';
import { definitionsOf, namespaceOf, SCHEMA_NAMESPACE } from './schema.ts';
import { emitDefs } from './ts-type.ts';

export function emitErrors(schema: ApiSchema, header: string): string {
  return `${header}\n${emitDefs(definitionsOf(namespaceOf(schema, SCHEMA_NAMESPACE.errorResponse)))}\n`;
}
