// Role: turns a wire name (`pane.selection.read`, `workspace_created`) into a PascalCase constant key, refuses duplicate keys, and derives file and constant names from entry and preset names.
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

// Splits a camelCase or kebab/underscore name into lower-case words ('readOnlyContent' -> ['read', 'only', 'content']).
function wordsOf(name: string): readonly string[] {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').split(SEPARATOR_PATTERN).filter((part) => part.length > 0).map((part) => part.toLowerCase());
}

// 'readOnlyContent' -> 'read-only-content' (a generated file name under src/generated/).
export function kebabOf(name: string): string {
  return wordsOf(name).join('-');
}

// 'readOnlyContent' -> 'READ_ONLY_CONTENT' (a generated constant name).
export function upperSnakeOf(name: string): string {
  return wordsOf(name).join('_').toUpperCase();
}
