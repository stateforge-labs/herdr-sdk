// Role: merges the $defs of several schema bundles that share one output module (events.ts).
// Informs HERDR-ADR-0002 and plan section 3.2 (repeated definitions: equal ones emitted once, different ones refused).
import { isString, JS_TYPE, SCHEMA_KEY } from './schema.ts';
import type { JSONSchema } from './schema.ts';
import { refName } from './ts-type.ts';

export interface NamedBundle {
  readonly name: string;
  readonly defs: Readonly<Record<string, JSONSchema>>;
}

// Every `$ref` is reduced to the bare definition name, so the bundle a ref points into does not matter.
export function normaliseRefs(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normaliseRefs);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, refValue(key, child)]),
    );
  }
  return value;
}

function refValue(key: string, child: unknown): unknown {
  if (key === SCHEMA_KEY.ref && isString(child)) {
    return refName(child);
  }
  return normaliseRefs(child);
}

// Object keys in sorted order, so two definitions compare equal regardless of how their keys were written.
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (isRecord(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === JS_TYPE.object && value !== null && !Array.isArray(value);
}

function canonicalText(definition: JSONSchema): string {
  return JSON.stringify(sortKeys(normaliseRefs(definition)));
}

export function structurallyEqual(left: JSONSchema, right: JSONSchema): boolean {
  return canonicalText(left) === canonicalText(right);
}

const CONFLICT_PREFIX = 'conflicting definition';

// First occurrence wins. A later definition of the same name is skipped when structurally equal and refused otherwise.
export function mergeDefinitions(bundles: readonly NamedBundle[]): Record<string, JSONSchema> {
  const merged: Record<string, JSONSchema> = {};
  const origin = new Map<string, string>();
  for (const bundle of bundles) {
    for (const [name, definition] of Object.entries(bundle.defs)) {
      const first = merged[name];
      if (first === undefined) {
        merged[name] = definition;
        origin.set(name, bundle.name);
      } else if (!structurallyEqual(first, definition)) {
        throw new Error(`${CONFLICT_PREFIX} '${name}' in bundles ${origin.get(name)} and ${bundle.name}`);
      }
    }
  }
  return merged;
}
