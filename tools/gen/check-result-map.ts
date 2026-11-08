// Role: pure check of the result map against the schema: unmapped methods, stale rows, unknown tags and reasonless loose rows.
// Informs HERDR-ADR-0002 and plan section 4.2 (the generator fails on an unmapped method or a reasonless LOOSE). Returns messages; tools/gen/index.ts throws on any.
import { methodNames } from './emit-method-table.ts';
import { RESULT_KIND } from './method-result-map.ts';
import type { ResultMap } from './method-result-map.ts';
import { branchesOf, constOf, definitionsOf, namespaceOf, SCHEMA_KEY, SCHEMA_NAMESPACE } from './schema.ts';
import type { ApiSchema } from './schema.ts';

const DEF_NAME = { responseResult: 'ResponseResult' } as const;

export const CHECK_MESSAGE = {
  unmapped: 'has no row in METHOD_RESULT_MAP',
  stale: 'is not a request method of the schema',
  unknownTag: 'names a tag that is not a ResponseResult tag',
  reasonless: 'is LOOSE without a reason',
} as const;

// Every ResponseResult tag of the schema.
function responseTags(schema: ApiSchema): ReadonlySet<string> {
  const union = definitionsOf(namespaceOf(schema, SCHEMA_NAMESPACE.successResponse))[DEF_NAME.responseResult];
  return new Set(branchesOf(union ?? {}).map((branch) => constOf(branch, SCHEMA_KEY.type)));
}

// Problems in the map, one message per problem; empty when the map covers the schema exactly.
export function checkResultMap(schema: ApiSchema, map: ResultMap): readonly string[] {
  const methods = new Set(methodNames(schema));
  const tags = responseTags(schema);
  const problems: string[] = [];
  for (const method of methods) {
    if (!Object.hasOwn(map, method)) {
      problems.push(`${method} ${CHECK_MESSAGE.unmapped}`);
    }
  }
  for (const [method, row] of Object.entries(map)) {
    if (!methods.has(method)) {
      problems.push(`${method} ${CHECK_MESSAGE.stale}`);
    }
    if (row.kind === RESULT_KIND.typed && !tags.has(row.tag)) {
      problems.push(`${method} ${CHECK_MESSAGE.unknownTag}: ${row.tag}`);
    }
    if (row.kind === RESULT_KIND.loose && row.reason.trim() === '') {
      problems.push(`${method} ${CHECK_MESSAGE.reasonless}`);
    }
  }
  return problems;
}
