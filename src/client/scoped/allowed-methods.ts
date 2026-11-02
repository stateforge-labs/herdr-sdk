// Role: the allow-list of one scoped client: its base method list (the entry's generated list, or a preset's), narrowed to a method list (never widened).
// Informs HERDR-ADR-0005 (runtime allow-list before sending), HERDR-ADR-0017 and plan 3.4 and 10.1 step 2 (the caller imports the one list it needs, so nothing else is bundled); contract in client/types.ts (AllowedMethods).
import type { Method } from '../../generated/index.ts';
import type { AllowedMethods } from '../types.ts';

export const allowedMethods: AllowedMethods = function allowedMethods(base, options = {}) {
  return options.methods === undefined ? new Set<Method>(base) : narrow(base, options.methods);
};

// A method outside the base list is dropped, not added: `methods` can only narrow the entry.
function narrow(base: readonly Method[], methods: readonly Method[]): ReadonlySet<Method> {
  const inBase = new Set<Method>(base);
  return new Set<Method>(methods.filter((method) => inBase.has(method)));
}
