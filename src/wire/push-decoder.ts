// Role: decodes one push line into a known frame or an UnknownFrame: the envelope is checked (event is a string, data is present), the data is not (P4).
// Informs HERDR-ADR-0016 (W2 pushes carry no id, P3 unknown kinds surfaced, P4 envelope-only validation), HERDR-ADR-0007 and plan 3.6; contract in wire/types.ts (DecodePush).
import { UNKNOWN_EVENT, WireField } from '../constants.ts';
import { EventKind, SubscriptionEventKind, type PushFrame } from '../generated/index.ts';
import { isObject } from './envelope.ts';
import type { DecodePush, UnknownFrame } from './types.ts';

// Field names and JSON type names this decoder reads (the push envelope has no other fields).
const PushField = {
  Data: 'data',
} as const;

const JsonType = {
  String: 'string',
} as const;

// Every event name herdr can push, built once from the generated kinds (no hand list).
const KNOWN_EVENTS: ReadonlySet<string> = new Set<string>([
  ...Object.values(EventKind),
  ...Object.values(SubscriptionEventKind),
]);

// A push line with a string event and a data field.
type PushShape = object & {
  readonly [WireField.Event]: string;
  readonly [PushField.Data]: unknown;
};

export const decodePush: DecodePush = function decodePush(line) {
  if (!hasPushShape(line)) {
    return undefined;
  }
  const event = line[WireField.Event];
  return isKnownEvent(event) ? toPushFrame(line) : toUnknownFrame(line, event);
};

function hasPushShape(line: unknown): line is PushShape {
  return (
    isObject(line) &&
    WireField.Event in line &&
    typeof line[WireField.Event] === JsonType.String &&
    PushField.Data in line
  );
}

function isKnownEvent(name: string): boolean {
  return KNOWN_EVENTS.has(name);
}

// The envelope is checked, the data is not (P4): the typed frame is the line itself, the caller trusts herdr's data shape.
function toPushFrame(line: PushShape): PushFrame {
  return line as PushFrame;
}

function toUnknownFrame(line: object, rawEvent: string): UnknownFrame {
  return { event: UNKNOWN_EVENT, rawEvent, raw: line };
}
