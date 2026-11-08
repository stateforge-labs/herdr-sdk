// Role: what the fake herdr says: answers, acks, pongs, param checks, held and subscription bookkeeping and the scripted steps.
// Informs HERDR-ADR-0016, plan 5, HERDR-ADR-0008; merged by HERDR-ADR-0021 from fake-values.ts, fake-write.ts, fake-socket-path.ts, fake-pong.ts, fake-defaults.ts, fake-ack.ts, fake-request-check.ts, fake-script.ts, fake-answer.ts, fake-held.ts, fake-subscription.ts, fake-subscribers.ts.
import { TypeofTag, LINE_SEPARATOR, TEXT_ENCODING, Fake, DEFAULT_CAPABILITIES, WireField, EMPTY_SCHEMA_RESULT, FakeMethod, FakeCheckText, FakeErrorCode, TypeofValue, AnswerKind, FakeText, EntryKey, NameSeparator, PER_PANE_SUBSCRIPTION_TYPES, SpecField } from '../../constants.ts';
import { isObject } from '../wire/codec.ts';
import type { Socket } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ResultTag, Method, ENTRY_METHODS, EventKind, SubscriptionType } from '../generated/index.ts';
import type { ErrorBody } from '../generated/index.ts';
import type { ServerCapabilities } from '../generated/results.ts';
import { JsonKind, PARAMS_SHAPE } from '../generated/test-data/shapes.ts';
import type { FieldShape, ParamsShape } from '../generated/test-data/shapes.ts';
import type { ReceivedRequest } from './types.ts';

// The field of a JSON object, or undefined when the value is not an object. JSON has no undefined, so undefined means absent.
export function fieldOf(value: unknown, name: string): unknown {
  return isObject(value) ? Reflect.get(value, name) : undefined;
}

// True for a string value.
export function isText(value: unknown): value is string {
  return typeof value === TypeofTag.String;
}

// One NDJSON line. A string is written as it is (a stray line), an object is serialised.
export function lineOf(value: object | string): string {
  const text = typeof value === TypeofTag.String ? value : JSON.stringify(value);
  return `${text}${LINE_SEPARATOR}`;
}

// A client may have destroyed its socket; a write to it must not crash the fake.
export function safeWrite(socket: Socket, text: string): void {
  try {
    socket.write(text, TEXT_ENCODING);
  } catch {
    // The client already went away; there is nobody left to write to.
  }
}

// Ends the socket from the server side; a socket that is already gone ignores it.
export function endSocket(socket: Socket): void {
  try {
    socket.end();
  } catch {
    // The client already went away; there is nothing to end.
  }
}

export interface FakeSocketLocation {
  readonly path: string;
  // The temp directory the fake created, or undefined when the caller gave the path.
  readonly ownedDir: string | undefined;
}

export function fakeSocketLocation(socketPath: string | undefined): FakeSocketLocation {
  if (socketPath !== undefined) {
    return { path: socketPath, ownedDir: undefined };
  }
  const dir = mkdtempSync(join(tmpdir(), Fake.DirPrefix));
  return { path: join(dir, Fake.SocketFile), ownedDir: dir };
}

export function removeOwnedDir(location: FakeSocketLocation): void {
  if (location.ownedDir !== undefined) {
    rmSync(location.ownedDir, { recursive: true, force: true });
  }
}

// What the pong says: the protocol, the fake version and, when given, the capabilities (null leaves the field out).
export interface PongSettings {
  readonly protocol: number;
  readonly version: string;
  readonly capabilities: ServerCapabilities | null;
}

// The capabilities option as the pong uses it: undefined means the default set.
export function advertisedCapabilities(option: ServerCapabilities | null | undefined): ServerCapabilities | null {
  return option === undefined ? DEFAULT_CAPABILITIES : option;
}

export function pongBody(settings: PongSettings): Record<string, unknown> {
  const body: Record<string, unknown> = {
    [WireField.Type]: ResultTag.Pong,
    [WireField.Protocol]: settings.protocol,
    [WireField.Version]: settings.version,
  };
  if (settings.capabilities !== null) {
    body[WireField.Capabilities] = settings.capabilities;
  }
  return body;
}

// The default result of a method, or undefined when the fake has no default for it.
export function defaultResultOf(method: string, pong: PongSettings): unknown {
  if (method === Method.Ping) {
    return pongBody(pong);
  }
  if (method === FakeMethod.ApiSchema) {
    return EMPTY_SCHEMA_RESULT;
  }
  return undefined;
}

export class AckSwitches {
  private splitNext = false;
  private strayNext: string | undefined;

  // The next ack is written in two chunks.
  splitNextAck(): void {
    this.splitNext = true;
  }

  // The next ack is preceded by this line.
  strayBeforeAck(line: string): void {
    this.strayNext = line;
  }

  // Writes the ack of the subscription with this request id, applying each switch once.
  acknowledge(socket: Socket, id: string): void {
    const ack = lineOf({
      [WireField.Id]: id,
      [WireField.Result]: { [WireField.Type]: ResultTag.SubscriptionStarted },
    });
    const text = `${this.takeStray()}${ack}`;
    if (this.takeSplit()) {
      writeSplit(socket, text);
    } else {
      safeWrite(socket, text);
    }
  }

  private takeStray(): string {
    const line = this.strayNext;
    this.strayNext = undefined;
    return line === undefined ? '' : lineOf(line);
  }

  private takeSplit(): boolean {
    const split = this.splitNext;
    this.splitNext = false;
    return split;
  }
}

// Writes the first half now and the rest after a short delay, so the client reads a partial line first.
function writeSplit(socket: Socket, text: string): void {
  const cut = Math.floor(text.length / 2);
  safeWrite(socket, text.slice(0, cut));
  setTimeout(() => {
    safeWrite(socket, text.slice(cut));
  }, Fake.SplitAckDelayMs);
}

// The shape of a method, or undefined when the generated table does not list it (then nothing is checked).
function shapeOf(method: string): ParamsShape | undefined {
  const shapes: Readonly<Record<string, ParamsShape>> = PARAMS_SHAPE;
  return Object.hasOwn(shapes, method) ? shapes[method] : undefined;
}

// The first problem with the params, as the error herdr would return; undefined when the params fit the shape.
// Absent params count as an empty object.
export function checkParams(method: string, params: unknown): ErrorBody | undefined {
  const shape = shapeOf(method);
  if (shape === undefined) {
    return undefined;
  }
  const value: unknown = params === undefined ? {} : params;
  if (!isObject(value)) {
    return Object.keys(shape.fields).length === 0 ? undefined : problem(FakeCheckText.NotAnObject(method));
  }
  for (const name of shape.required) {
    if (fieldOf(value, name) === undefined) {
      return problem(FakeCheckText.MissingField(method, name));
    }
  }
  for (const [name, field] of Object.entries(shape.fields)) {
    const present = fieldOf(value, name);
    if (present !== undefined) {
      const fieldProblem = checkField(method, name, field, present);
      if (fieldProblem !== undefined) {
        return fieldProblem;
      }
    }
  }
  return undefined;
}

function checkField(method: string, name: string, field: FieldShape, value: unknown): ErrorBody | undefined {
  const kind = jsonKindOf(value);
  if (!field.kinds.some((allowed) => kindFits(kind, allowed))) {
    return problem(FakeCheckText.WrongKind(method, name));
  }
  if (field.enum !== undefined && isText(value) && !field.enum.includes(value)) {
    return problem(FakeCheckText.NotInEnum(method, name));
  }
  if (field.keyPattern !== undefined && isObject(value)) {
    const pattern = new RegExp(field.keyPattern);
    if (Object.keys(value).some((key) => !pattern.test(key))) {
      return problem(FakeCheckText.KeyNotAllowed(method, name));
    }
  }
  return undefined;
}

// An integer is also a number (JSON Schema): a field that allows number takes 3.
function kindFits(actual: JsonKind, allowed: JsonKind): boolean {
  return actual === allowed || (allowed === JsonKind.Number && actual === JsonKind.Integer);
}

// The JSON kind of a parsed value.
export function jsonKindOf(value: unknown): JsonKind {
  if (value === null) {
    return JsonKind.Null;
  }
  if (Array.isArray(value)) {
    return JsonKind.Array;
  }
  if (isText(value)) {
    return JsonKind.String;
  }
  if (typeof value === TypeofValue.Number) {
    return Number.isInteger(value) ? JsonKind.Integer : JsonKind.Number;
  }
  if (typeof value === TypeofValue.Boolean) {
    return JsonKind.Boolean;
  }
  return JsonKind.Object;
}

function problem(message: string): ErrorBody {
  return { code: FakeErrorCode.InvalidParams, message };
}

// One scripted step: a result, or an error envelope. The typed FakeHerdr.replySequence checks each step against its method.
export type ScriptedStep = { readonly result: unknown } | { readonly error: ErrorBody };

export class FakeScript {
  private readonly replies = new Map<string, unknown>();
  private readonly failures = new Map<string, ErrorBody>();
  private readonly rawLines = new Map<string, string>();
  private readonly silences = new Set<string>();
  private readonly sequences = new Map<string, ScriptedStep[]>();
  private readonly received: ReceivedRequest[] = [];

  setReply(method: string, result: unknown): void {
    this.replies.set(method, result);
  }

  setFailure(method: string, error: ErrorBody): void {
    this.failures.set(method, error);
  }

  setRawLine(method: string, line: string): void {
    this.rawLines.set(method, line);
  }

  setSilent(method: string): void {
    this.silences.add(method);
  }

  // Stores a copy, so a later change to the caller's array does not change the script.
  setSequence(method: string, steps: readonly ScriptedStep[]): void {
    this.sequences.set(method, [...steps]);
  }

  // The next step of the sequence, consumed; undefined when the method has no steps left.
  takeStep(method: string): ScriptedStep | undefined {
    return this.sequences.get(method)?.shift();
  }

  record(request: ReceivedRequest): void {
    this.received.push(request);
  }

  methods(): readonly string[] {
    return this.received.map((request) => request.method);
  }

  requests(): readonly ReceivedRequest[] {
    return [...this.received];
  }

  // True when a test scripted this method to be silent, raw, refused or with steps left; such a method is not acknowledged as a subscription.
  // A reply alone does not count: events.subscribe is answered by its ack (F2) unless a test scripts one of the outcomes above.
  hasScriptedOutcome(method: string): boolean {
    return this.silences.has(method) || this.rawLines.has(method) || this.failures.has(method) || (this.sequences.get(method)?.length ?? 0) > 0;
  }

  isSilent(method: string): boolean {
    return this.silences.has(method);
  }

  rawLineOf(method: string): string | undefined {
    return this.rawLines.get(method);
  }

  failureOf(method: string): ErrorBody | undefined {
    return this.failures.get(method);
  }

  hasReply(method: string): boolean {
    return this.replies.has(method);
  }

  replyOf(method: string): unknown {
    return this.replies.get(method);
  }
}

export type Answer =
  | { readonly kind: typeof AnswerKind.Silent }
  | { readonly kind: typeof AnswerKind.Raw; readonly line: string }
  | { readonly kind: typeof AnswerKind.Envelope; readonly body: Record<string, unknown> };

const SILENT: Answer = { kind: AnswerKind.Silent };

export function answerFor(script: FakeScript, request: ReceivedRequest, pong: PongSettings): Answer {
  const { id, method } = request;
  if (script.isSilent(method)) {
    return SILENT;
  }
  const rawLine = script.rawLineOf(method);
  if (rawLine !== undefined) {
    return { kind: AnswerKind.Raw, line: rawLine };
  }
  const refusal = checkParams(method, request.params);
  if (refusal !== undefined) {
    return errorAnswer(id, refusal);
  }
  const step = script.takeStep(method);
  if (step !== undefined) {
    return stepAnswer(id, step);
  }
  const failure = script.failureOf(method);
  if (failure !== undefined) {
    return errorAnswer(id, failure);
  }
  if (script.hasReply(method)) {
    return resultAnswer(id, script.replyOf(method));
  }
  const fallback = defaultResultOf(method, pong);
  if (fallback !== undefined) {
    return resultAnswer(id, fallback);
  }
  return errorAnswer(id, { code: Fake.UnknownMethodCode, message: FakeText.UnknownMethod(method) });
}

// The answer to a line that is not a JSON request: herdr replies with the empty id and an error (W3).
export function invalidRequestAnswer(): Answer {
  return errorAnswer('', { code: Fake.InvalidRequestCode, message: FakeText.InvalidRequest });
}

// An envelope with this error.
export function errorAnswer(id: string, error: ErrorBody): Answer {
  return { kind: AnswerKind.Envelope, body: { [WireField.Id]: id, [WireField.Error]: error } };
}

function stepAnswer(id: string, step: ScriptedStep): Answer {
  return WireField.Error in step ? errorAnswer(id, step.error) : resultAnswer(id, step.result);
}

function resultAnswer(id: string, result: unknown): Answer {
  return { kind: AnswerKind.Envelope, body: { [WireField.Id]: id, [WireField.Result]: result } };
}

// True for a class C method: the connection-bound ones herdr keeps open after the answer.
export function isHeldMethod(method: string): boolean {
  const heldMethods: readonly string[] = ENTRY_METHODS[EntryKey.held];
  return heldMethods.includes(method);
}

export class HeldConnections {
  private readonly sockets = new Set<Socket>();

  add(socket: Socket): void {
    this.sockets.add(socket);
  }

  // A connection that closed leaves the set.
  forget(socket: Socket): void {
    this.sockets.delete(socket);
  }

  count(): number {
    return this.sockets.size;
  }

  // Ends every held connection from the server side; the client sees its connection end.
  closeAll(): void {
    for (const socket of this.sockets) {
      endSocket(socket);
    }
    this.sockets.clear();
  }
}

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

export class Subscribers {
  private readonly specsBySocket = new Map<Socket, readonly SubscriptionSpec[]>();
  // Frames queued while pushes are held; undefined when pushes flow.
  private queued: PushLike[] | undefined;

  add(socket: Socket, specs: readonly SubscriptionSpec[]): void {
    this.specsBySocket.set(socket, specs);
  }

  // A connection that closed leaves the set.
  forget(socket: Socket): void {
    this.specsBySocket.delete(socket);
  }

  count(): number {
    return this.specsBySocket.size;
  }

  // Writes the frame to every matching subscription, or queues it while pushes are held.
  push(frame: PushLike): void {
    if (this.queued !== undefined) {
      this.queued.push(frame);
      return;
    }
    this.deliver(frame);
  }

  // Queues pushes until the returned release runs; release writes the queued frames in order. A second release does nothing.
  holdPushes(): () => void {
    const queue: PushLike[] = [];
    this.queued = queue;
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      this.queued = undefined;
      for (const frame of queue) {
        this.deliver(frame);
      }
    };
  }

  // Ends every subscription connection from the server side; the client sees the subscription end.
  closeAll(): void {
    for (const socket of this.specsBySocket.keys()) {
      endSocket(socket);
    }
    this.specsBySocket.clear();
  }

  private deliver(frame: PushLike): void {
    const line = lineOf(frame);
    for (const [socket, specs] of this.specsBySocket) {
      if (reaches(specs, frame)) {
        safeWrite(socket, line);
      }
    }
  }
}
