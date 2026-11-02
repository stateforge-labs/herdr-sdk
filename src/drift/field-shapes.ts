// Role: fieldShapesOf(): one stable text per params and result definition, keyed `<bundle>.<definition>`.
// Informs HERDR-ADR-0009 (drift reports a changed field shape). The bundle prefix keeps a name used by two bundles as two entries.
import { SchemaNamespace } from './constants.ts';
import { stableText } from './stable-text.ts';
import { definitionsOf, namespaceOf } from './schema-walk.ts';
import type { SchemaDocument } from './types.ts';

export function fieldShapesOf(schema: SchemaDocument): Record<string, string> {
  const shapes: Record<string, string> = {};
  for (const bundle of [SchemaNamespace.Request, SchemaNamespace.SuccessResponse]) {
    for (const [name, node] of Object.entries(definitionsOf(namespaceOf(schema, bundle)))) {
      shapes[`${bundle}.${name}`] = stableText(node);
    }
  }
  return shapes;
}
