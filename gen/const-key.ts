// Role: turns a wire name (`pane.selection.read`, `workspace_created`) into a PascalCase constant key, and refuses duplicate keys.
// Informs HERDR-ADR-0002 and plan section 3.2 (emit-names.ts key rule; new).
const SEPARATOR_PATTERN = /[._-]/;
const DUPLICATE_PREFIX = 'duplicate constant key';

function capitalise(part: string): string {
  return part.charAt(0).toUpperCase() + part.slice(1);
}

// 'pane.selection.read' -> 'PaneSelectionRead'; 'workspace_created' -> 'WorkspaceCreated'.
export function constKey(wire: string): string {
  return wire.split(SEPARATOR_PATTERN).filter((part) => part.length > 0).map(capitalise).join('');
}

// Throws when two wire names in one table would share a constant key ('a.b' and 'a_b' both give 'AB').
export function assertUniqueKeys(wires: readonly string[]): void {
  const seen = new Set<string>();
  for (const wire of wires) {
    const key = constKey(wire);
    if (seen.has(key)) {
      throw new Error(`${DUPLICATE_PREFIX} '${key}'`);
    }
    seen.add(key);
  }
}
