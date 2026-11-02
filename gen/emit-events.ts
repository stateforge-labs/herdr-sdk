// Role: emits events.ts, the event and subscription_event definitions in one module, with the frame unions.
// Informs HERDR-ADR-0002 and plan section 3.2 (repeated definitions merged by merge-defs.ts; ported from atalaya-bridge 097adfd gen/emit-events.ts).
import type { ApiSchema } from './schema.ts';
import { definitionsOf, namespaceOf, SCHEMA_NAMESPACE } from './schema.ts';
import { mergeDefinitions } from './merge-defs.ts';
import { emitDefs } from './ts-type.ts';

export function emitEvents(schema: ApiSchema, header: string): string {
  const merged = mergeDefinitions([
    { name: SCHEMA_NAMESPACE.event, defs: definitionsOf(namespaceOf(schema, SCHEMA_NAMESPACE.event)) },
    {
      name: SCHEMA_NAMESPACE.subscriptionEvent,
      defs: definitionsOf(namespaceOf(schema, SCHEMA_NAMESPACE.subscriptionEvent)),
    },
  ]);
  return `${header}
${emitDefs(merged)}

export type EventFrame = { event: EventKind; data: EventData };

export type SubscriptionEventFrame = { event: SubscriptionEventKind; data: SubscriptionEventData };

/** Any frame that can arrive on a subscription connection after the ack. */
export type PushFrame = EventFrame | SubscriptionEventFrame;
`;
}
