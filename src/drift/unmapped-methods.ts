// Role: unmappedMethods(): the installed methods that have no row in the generated METHOD_RESULT table.
// Informs HERDR-ADR-0009 and plan 4.2 (a method without a result mapping is drift). Layer.Drift may import Generated.
import { METHOD_RESULT } from '../generated/index.ts';

export function unmappedMethods(methods: readonly string[]): string[] {
  return methods.filter((method) => !Object.hasOwn(METHOD_RESULT, method)).toSorted();
}
