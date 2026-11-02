// Role: stableText(): a JSON text with sorted keys and without the schema keyword `description`, so the same shape always gives the same string.
// Informs HERDR-ADR-0009 (report lists changed field shapes); a wording change in a description is not drift. Keys of the `properties` and `$defs` maps are names, never keywords, so they are kept.
import { SchemaKey } from './constants.ts';
import { isNode } from './schema-walk.ts';

// Keywords whose value maps names to schemas: their keys are names, so a name such as `description` is kept.
const NAME_MAP_KEYWORDS: readonly string[] = [SchemaKey.Properties, SchemaKey.Defs];

export function stableText(value: unknown): string {
  return JSON.stringify(withSortedKeys(value));
}

function withSortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withSortedKeys);
  }
  if (!isNode(value)) {
    return value;
  }
  const keys = Object.keys(value).filter((key) => key !== SchemaKey.Description).toSorted();
  return Object.fromEntries(keys.map((key) => [key, valueUnder(key, value[key])]));
}

// A child of a name map is a schema whose keys are names too; sorting keeps the same text for the same shape.
function valueUnder(key: string, child: unknown): unknown {
  return NAME_MAP_KEYWORDS.includes(key) && isNode(child) ? namesOf(child) : withSortedKeys(child);
}

function namesOf(map: Readonly<Record<string, unknown>>): unknown {
  return Object.fromEntries(Object.keys(map).toSorted().map((name) => [name, withSortedKeys(map[name])]));
}
