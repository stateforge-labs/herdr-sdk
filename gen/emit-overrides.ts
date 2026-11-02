// Role: emits overrides.ts, the runtime long-poll, stream-return and capability-gate tables built from gen/overrides.ts.
// Informs HERDR-ADR-0007 and plan section 3.6 (emit-overrides.ts, new). Data only; the checks run in gen/overrides.ts.
import { OVERRIDES } from './overrides.ts';
import type { Override } from './overrides.ts';

type OverrideEntry = readonly [string, Override];

// Override entries sorted by method name, keeping only those that carry the given field.
function entriesWith(field: keyof Override): readonly OverrideEntry[] {
  return Object.entries(OVERRIDES)
    .filter(([, override]) => override[field] !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
}

// One LONG_POLL row: the timeout path, the bounds and the gate that applies to it.
function longPollRow(override: Override): string {
  const fields: string[] = [];
  if (override.requiredTimeoutPath !== undefined) {
    fields.push(`timeoutPath: ${JSON.stringify(override.requiredTimeoutPath)}`);
  }
  if (override.timeoutBounds !== undefined) {
    fields.push(`bounds: ${JSON.stringify(override.timeoutBounds)}`);
  }
  if (override.onlyWhenPresent !== undefined) {
    fields.push(`onlyWhenPresent: ${JSON.stringify(override.onlyWhenPresent)}`);
  }
  return `{ ${fields.join(', ')} }`;
}

function longPollLines(): string {
  return entriesWith('requiredTimeoutPath')
    .map(([method, override]) => `  ${JSON.stringify(method)}: ${longPollRow(override)},`)
    .join('\n');
}

// One `method: value` line per entry, where the value is the override field named by `pick`.
function valueLines(entries: readonly OverrideEntry[], pick: (override: Override) => string | undefined): string {
  return entries
    .map(([method, override]) => `  ${JSON.stringify(method)}: ${JSON.stringify(pick(override))},`)
    .join('\n');
}

export function emitOverrides(banner: string): string {
  return `${banner}
import type { Method } from './names/method.ts';

interface LongPollRow {
  readonly timeoutPath: readonly string[];
  readonly bounds?: { readonly exclusiveMin: number; readonly max: number };
  readonly onlyWhenPresent?: string;
}

/** Methods whose rpc timeout follows a timeout_ms field (plan 3.6). */
export const LONG_POLL = {
${longPollLines()}
} as const satisfies Partial<Record<Method, LongPollRow>>;

/** Subscribe-style methods and the kind of value they return (phase 4a replaces the placeholder). */
export const STREAM_RETURNS = {
${valueLines(entriesWith('returns'), (override) => override.returns)}
} as const satisfies Partial<Record<Method, string>>;

/** Methods gated on a ServerCapabilities key (plan 3.1). */
export const CAPABILITY_GATE = {
${valueLines(entriesWith('capability'), (override) => override.capability)}
} as const satisfies Partial<Record<Method, string>>;
`;
}
