// Role: the allow-list of one entry: its generated method set, narrowed to a preset or to a method list (never widened).
// Informs HERDR-ADR-0005 (runtime allow-list before sending) and plan 3.4 (entries, presets, the methods option); contract in client/types.ts (AllowedMethods).
import { ENTRY_METHODS, Method, PRESET_METHODS } from '../../generated/index.ts';
import type { Preset } from '../../constants.ts';
import type { AllowedMethods, EntryName } from '../types.ts';

export const allowedMethods: AllowedMethods = function allowedMethods(entry, options = {}) {
  const base = options.preset === undefined ? entrySet(entry) : presetSet(options.preset);
  return options.methods === undefined ? base : narrow(base, options.methods);
};

function entrySet(entry: EntryName): ReadonlySet<Method> {
  return new Set<Method>(ENTRY_METHODS[entry]);
}

function presetSet(preset: Preset): ReadonlySet<Method> {
  return new Set<Method>(PRESET_METHODS[preset]);
}

// A method outside the entry is dropped, not added: `methods` can only narrow the entry.
function narrow(base: ReadonlySet<Method>, methods: readonly Method[]): ReadonlySet<Method> {
  return new Set<Method>(methods.filter((method) => base.has(method)));
}
