// Role: nameDiff(): the names an installed herdr added and removed against the committed copy, each sorted; hasMovement(): whether a diff lists anything.
// Informs HERDR-ADR-0009 (added and removed are listed separately).
import type { NameDiff } from './types.ts';

export function nameDiff(committed: readonly string[], installed: readonly string[]): NameDiff {
  return {
    added: missingFrom(installed, committed),
    removed: missingFrom(committed, installed),
  };
}

export function hasMovement(diff: NameDiff): boolean {
  return diff.added.length > 0 || diff.removed.length > 0;
}

function missingFrom(names: readonly string[], others: readonly string[]): string[] {
  const known = new Set(others);
  return names.filter((name) => !known.has(name)).toSorted();
}
