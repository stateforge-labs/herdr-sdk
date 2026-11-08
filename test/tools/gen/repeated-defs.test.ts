// Role: tests repeated definitions across schema bundles (same name, different or equal shapes) against the emitters.
// Informs HERDR-ADR-0002 and plan section 3.2 (emitted once per module, deduplicated when equal, refused when different).
import { describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitEvents } from '../../../tools/gen/emit-events.ts';
import { emitParams } from '../../../tools/gen/emit-params.ts';
import { emitResults } from '../../../tools/gen/emit-results.ts';
import type { ApiSchema } from '../../../tools/gen/schema.ts';
import { loadSchema, namespaceOf, SCHEMA_NAMESPACE } from '../../../tools/gen/schema.ts';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(TEST_DIR, 'fixtures', 'repeated-defs.schema.json');
const HEADER = '';

const SHARED_NAME = { agentStatus: 'AgentStatus', paneInfo: 'PaneInfo' } as const;
const CONFLICT_MESSAGE = "conflicting definition 'AgentStatus' in bundles event and subscription_event";

function countOf(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

// Same fixture, but the subscription_event AgentStatus has a different value list.
function withSubscriptionStatus(fixture: ApiSchema, values: readonly string[]): ApiSchema {
  const subscription = namespaceOf(fixture, SCHEMA_NAMESPACE.subscriptionEvent);
  return {
    ...fixture,
    schemas: {
      ...fixture.schemas,
      [SCHEMA_NAMESPACE.subscriptionEvent]: {
        ...subscription,
        $defs: {
          ...subscription.$defs,
          [SHARED_NAME.agentStatus]: { enum: values, type: 'string' },
        },
      },
    },
  };
}

describe('a name used in two bundles with different shapes', () => {
  const fixture = loadSchema(FIXTURE_PATH);
  const params = emitParams(fixture, HEADER);
  const results = emitResults(fixture, HEADER);

  test('the request bundle keeps its own PaneInfo in the params module', () => {
    expect(params).toContain(`export type ${SHARED_NAME.paneInfo} = { "pane_id": string; };`);
    expect(params).not.toContain('"label"');
  });

  test('the success_response bundle keeps its own PaneInfo in the results module', () => {
    expect(results).toContain(`export type ${SHARED_NAME.paneInfo} = { "label": string | null; };`);
    expect(results).not.toContain('"pane_id"');
  });
});

describe('a name used in event and subscription_event', () => {
  const fixture = loadSchema(FIXTURE_PATH);

  test('an equal definition is emitted once in the events module', () => {
    const events = emitEvents(fixture, HEADER);
    expect(countOf(events, `export type ${SHARED_NAME.agentStatus} =`)).toBe(1);
  });

  test('the subscription-only definitions are still emitted', () => {
    const events = emitEvents(fixture, HEADER);
    expect(events).toContain('export type SubscriptionEventKind =');
    expect(events).toContain('export type SubscriptionEventData =');
  });

  test('a different definition under the same name is refused', () => {
    const broken = withSubscriptionStatus(fixture, ['idle', 'done']);
    expect(() => emitEvents(broken, HEADER)).toThrow(CONFLICT_MESSAGE);
  });
});
