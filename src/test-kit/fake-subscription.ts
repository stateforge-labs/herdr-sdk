// Role: one subscription's specs (type and pane_id), the refusals of events.subscribe (a bad shape, an unknown spec type, a per-pane spec without pane_id),
// and which subscriptions a pushed frame reaches.
// Informs HERDR-ADR-0016 (W6: per-pane types need pane_id, and a per-pane frame reaches only its pane), generated/names.ts (SubscriptionType) and
// generated/events.ts (EventKind: pane_output_changed has no subscription type, so it reaches no subscription); test-kit only.
import { FakeCheckText, FakeErrorCode, NameSeparator, PER_PANE_SUBSCRIPTION_TYPES, SpecField, WireField } from '../constants.ts';
import { EventKind, Method, SubscriptionType, type ErrorBody } from '../generated/index.ts';
import { isObject } from '../wire/envelope.ts';
import { checkParams } from './fake-request-check.ts';
import { fieldOf, isText } from './fake-values.ts';

export interface SubscriptionSpec {
  readonly type: SubscriptionType;
  readonly paneId: string | undefined;
}

// A push frame as the fake reads it: its event and its data (a typed PushFrame or an UnknownPush).
export interface PushLike {
  readonly event: string;
  readonly data: unknown;
}

const SUBSCRIPTION_TYPES: ReadonlySet<string> = new Set(Object.values(SubscriptionType));
const PER_PANE_TYPES: ReadonlySet<string> = new Set(PER_PANE_SUBSCRIPTION_TYPES);
const EVENT_KINDS: ReadonlySet<string> = new Set(Object.values(EventKind));
// The frame names that each subscription type answers to. A subscription type names itself (pane.output_matched); an event kind names it
// with its first separator changed (pane_created is pane.created). Built once, here, from the generated names: no other place maps names.
const TYPE_BY_FRAME_NAME: ReadonlyMap<string, SubscriptionType> = frameNameTable();

// Why herdr would refuse this events.subscribe: params that break the generated shape, a spec that is not a known type, or a per-pane spec without
// pane_id. Undefined when it is accepted.
export function subscribeRefusal(params: unknown): ErrorBody | undefined {
  const shapeProblem = checkParams(Method.EventsSubscribe, params);
  if (shapeProblem !== undefined) {
    return shapeProblem;
  }
  if (entriesOf(params).some((entry) => !isSpecEntry(entry))) {
    return { code: FakeErrorCode.InvalidParams, message: FakeCheckText.WrongKind(Method.EventsSubscribe, SpecField.Subscriptions) };
  }
  const withoutPane = specsOf(params).find((spec) => PER_PANE_TYPES.has(spec.type) && spec.paneId === undefined);
  return withoutPane === undefined ? undefined : { code: FakeErrorCode.InvalidParams, message: FakeCheckText.NeedsPaneId(withoutPane.type) };
}

// The specs of an events.subscribe request, in order. Entries that are not a known spec type are skipped (subscribeRefusal refuses them first).
export function specsOf(params: unknown): readonly SubscriptionSpec[] {
  return entriesOf(params).flatMap((entry) => {
    const type = fieldOf(entry, WireField.Type);
    if (!isSubscriptionType(type)) {
      return [];
    }
    const paneId = fieldOf(entry, SpecField.PaneId);
    return [{ type, paneId: isText(paneId) ? paneId : undefined }];
  });
}

// Whether a pushed frame reaches the subscription with these specs. A frame whose name is a subscription type reaches a spec of that type, and a
// per-pane type reaches only the spec whose pane_id is the frame's. A known event kind with no subscription type (pane_output_changed) reaches nobody:
// herdr offers it only through events.wait. A kind the fake does not know at all reaches every subscription, on purpose: herdr may push kinds nobody asked for (P3).
export function reaches(specs: readonly SubscriptionSpec[], frame: PushLike): boolean {
  const type = TYPE_BY_FRAME_NAME.get(frame.event);
  if (type === undefined) {
    return !EVENT_KINDS.has(frame.event);
  }
  const paneId = fieldOf(frame.data, SpecField.PaneId);
  return specs.some((spec) => spec.type === type && (!PER_PANE_TYPES.has(type) || spec.paneId === paneId));
}

// The frame name table: each subscription type, and its event-kind spelling (first separator changed) when it differs.
function frameNameTable(): ReadonlyMap<string, SubscriptionType> {
  const names = new Map<string, SubscriptionType>();
  for (const type of Object.values(SubscriptionType)) {
    names.set(type, type);
    names.set(type.replace(NameSeparator.Subscription, NameSeparator.Event), type);
  }
  return names;
}

function entriesOf(params: unknown): readonly unknown[] {
  const entries = fieldOf(params, SpecField.Subscriptions);
  return Array.isArray(entries) ? entries : [];
}

function isSubscriptionType(value: unknown): value is SubscriptionType {
  return isText(value) && SUBSCRIPTION_TYPES.has(value);
}

function isSpecEntry(entry: unknown): boolean {
  return isObject(entry) && isSubscriptionType(fieldOf(entry, WireField.Type));
}
