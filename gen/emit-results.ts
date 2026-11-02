// Role: emits results.ts, one result type per response tag, ResponseResult, ResultByTag, ResultTag and METHOD_RESULT.
// Informs HERDR-ADR-0002 and plan sections 3.2 and 4.2 (ported from atalaya-bridge 097adfd gen/emit-results.ts).
import type { ApiSchema, JSONSchema } from './schema.ts';
import { branchesOf, constOf, definitionsOf, namespaceOf, SCHEMA_KEY, SCHEMA_NAMESPACE } from './schema.ts';
import { methodResultTags } from './method-result-map.ts';
import { emitDefs, tsType } from './ts-type.ts';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const TYPE_NAME_PREFIX = 'Result_';
const TYPE_NAME_PLACEHOLDER = '_';

const DEF_NAME = { responseResult: 'ResponseResult' } as const;

function isAlphanumeric(character: string): boolean {
  return ALPHABET.includes(character.toLowerCase()) || DIGITS.includes(character);
}

// Type name for one response tag: every character that is not a letter or digit becomes '_'.
export function typeName(tag: string): string {
  let out = TYPE_NAME_PREFIX;
  for (const character of tag) {
    out += isAlphanumeric(character) ? character : TYPE_NAME_PLACEHOLDER;
  }
  return out;
}

interface Variant {
  readonly tag: string;
  readonly name: string;
  readonly ts: string;
}

function variantsOf(union: JSONSchema): readonly Variant[] {
  return branchesOf(union).map((branch) => {
    const tag = constOf(branch, SCHEMA_KEY.type);
    return { tag, name: typeName(tag), ts: tsType(branch) };
  });
}

export function emitResults(schema: ApiSchema, header: string): string {
  const definitions = definitionsOf(namespaceOf(schema, SCHEMA_NAMESPACE.successResponse));
  const union = definitions[DEF_NAME.responseResult];
  if (union === undefined) {
    throw new Error(`${SCHEMA_NAMESPACE.successResponse} carries no '${DEF_NAME.responseResult}'`);
  }
  const variants = variantsOf(union);
  return `${header}
import type { Method } from './methods.ts';

${emitDefs(definitions, new Set([DEF_NAME.responseResult]))}

${variants.map((variant) => `export type ${variant.name} = ${variant.ts};`).join('\n\n')}

/** The full union of every result shape the server can return. */
export type ResponseResult =
${variants.map((variant) => `  | ${variant.name}`).join('\n')};

/** Result shape, keyed by its \`type\` tag. */
export interface ResultByTag {
${variants.map((variant) => `  ${JSON.stringify(variant.tag)}: ${variant.name};`).join('\n')}
}

export type ResultTag = keyof ResultByTag;

/** Method -> response tag for every typed row of gen/method-result-map.ts (LOOSE rows are absent: ResultOf falls back to ResponseResult). Completed in phase 3 (plan 4.2). */
export const METHOD_RESULT = ${JSON.stringify(methodResultTags(), null, 2)} as const satisfies Partial<Record<Method, ResultTag>>;
`;
}
