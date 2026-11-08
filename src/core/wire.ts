// Role: the herdr-core wire: NDJSON JSON-RPC 2.0 codec, message parsers, the socket path rule and the backoff step.
// Informs HERDR-ADR-0020 (the herdr-core client); ported from the desktop work in herdr-plugins.
import { StringDecoder } from 'node:string_decoder';
import { join } from 'node:path';
import { err, isErr, isOk, must, ok, type Result } from './kernel.ts';
import { brand, type Brand } from './kernel.ts';
import { parseCount, type Count } from './kernel.ts';
import { duration, type Duration } from './kernel.ts';
import { parseNonEmptyText, parseText, type NonEmptyText, type Text } from './kernel.ts';
import { isFields, isNumber, isString } from './kernel.ts';
import { ParseFailureKind } from './errors.ts';
import type { ParseFailure } from './errors.ts';
import { HC_JSONRPC_VERSION, HC_LINE_SEPARATOR, HcField, HcKind, HcNotificationMethod, UTF8 } from './constants.ts';
import { HC_LINE_CAP, HC_DEFAULT_SESSION, HC_RUNTIME_ENV, HC_RUN_ROOT, HC_SESSION_ENV, HC_SOCKET_ENV, HC_SOCKET_FOLDER, HC_SOCKET_SUFFIX } from './constants.ts';

export type HcCallId = Brand<number, 'HcCallId'>;
export type RpcCode = Brand<number, 'RpcCode'>;
export type WireLine = Brand<string, 'WireLine'>;
export type WireChunk = Brand<Buffer, 'WireChunk'>;
export type SocketPath = Brand<string, 'SocketPath'>;
export type HcPayload = Brand<object, 'HcPayload'>;
export type HcParams = Brand<object, 'HcParams'>;
export type HcTransport = Brand<string, 'HcTransport'>;

export interface HcSnapshot {
  readonly seq: Count;
  readonly terminals: readonly HcPayload[];
}

export interface HcCoreHello {
  readonly version: Text;
  readonly methods: readonly NonEmptyText[];
  readonly generation: Count;
}

export interface HcReply { readonly kind: typeof HcKind.Reply; readonly id: HcCallId; readonly result: HcPayload }
export interface HcOdd { readonly kind: typeof HcKind.Odd; readonly id: HcCallId }
export interface HcFault { readonly kind: typeof HcKind.Fault; readonly id: HcCallId; readonly code: RpcCode; readonly reason: Text; readonly message: Text }
export interface HcEvent { readonly kind: typeof HcKind.Event; readonly seq: Count; readonly terminal: NonEmptyText | null; readonly type: NonEmptyText; readonly data: HcPayload }
export interface HcHeartbeat { readonly kind: typeof HcKind.Heartbeat; readonly seq: Count }
export interface HcMissed { readonly kind: typeof HcKind.Missed; readonly snapshot: HcSnapshot }

export type HcNotification = HcEvent | HcHeartbeat | HcMissed;
export type HcCoreMessage = HcReply | HcOdd | HcFault | HcNotification;

const NOT_A_ROW: ParseFailure = { kind: ParseFailureKind.NotARow };
const EMPTY = must(parseText(''));
const NO_DATA: HcPayload = must(parseHcPayload({}));

export function parseHcPayload(input: unknown): Result<HcPayload, ParseFailure> {
  return isFields(input) ? ok(brand<object, 'HcPayload'>(input)) : err(NOT_A_ROW);
}

export function parseHcParams(input: unknown): Result<HcParams, ParseFailure> {
  return isFields(input) ? ok(brand<object, 'HcParams'>(input)) : err(NOT_A_ROW);
}

export function parseHcTransport(input: unknown): Result<HcTransport, ParseFailure> {
  const text = parseNonEmptyText(input);
  return isErr(text) ? text : ok(brand<string, 'HcTransport'>(text.value.trim().toLowerCase()));
}

export function parseWireChunk(input: unknown): Result<WireChunk, ParseFailure> {
  return Buffer.isBuffer(input) ? ok(brand<Buffer, 'WireChunk'>(input)) : err(NOT_A_ROW);
}

export function parseWireLine(input: unknown): Result<WireLine, ParseFailure> {
  const text = parseText(input);
  return isErr(text) ? text : ok(brand<string, 'WireLine'>(text.value));
}

export function parseSocketPath(input: unknown): Result<SocketPath, ParseFailure> {
  const text = parseNonEmptyText(input);
  return isErr(text) ? text : ok(brand<string, 'SocketPath'>(text.value));
}

export function parseHcCallId(input: unknown): Result<HcCallId, ParseFailure> {
  const count = parseCount(input);
  return isErr(count) ? count : ok(brand<number, 'HcCallId'>(count.value));
}

export function parseRpcCode(input: unknown): Result<RpcCode, ParseFailure> {
  if (!isNumber(input)) {
    return err({ kind: ParseFailureKind.NotANumber });
  }
  return Number.isInteger(input) ? ok(brand<number, 'RpcCode'>(input)) : err({ kind: ParseFailureKind.NotAnInteger });
}

export function encodeHcCoreRequest(id: HcCallId, method: NonEmptyText, params: HcParams): WireLine {
  return must(parseWireLine(`${JSON.stringify({ [HcField.JsonRpc]: HC_JSONRPC_VERSION, [HcField.Id]: id, [HcField.Method]: method, [HcField.Params]: params })}${HC_LINE_SEPARATOR}`));
}

export class HcCoreLines {
  private readonly decoder = new StringDecoder(UTF8);
  private readonly overrun: () => void;
  private readonly cap: Count;
  private rest: Text = EMPTY;

  constructor(overrun: () => void = (): void => undefined, cap: Count = HC_LINE_CAP) {
    this.overrun = overrun;
    this.cap = cap;
  }

  feed(chunk: WireChunk): readonly HcPayload[] {
    const fresh = this.decoder.write(chunk);
    const cut = fresh.lastIndexOf(HC_LINE_SEPARATOR);
    const text = this.rest + (cut < 0 ? fresh : fresh.slice(0, cut));
    if (text.length > this.cap) {
      this.rest = EMPTY;
      this.overrun();
      return [];
    }
    if (cut < 0) {
      this.rest = must(parseText(text));
      return [];
    }
    this.rest = must(parseText(fresh.slice(cut + 1)));
    const found: HcPayload[] = [];
    for (const line of text.split(HC_LINE_SEPARATOR)) {
      try {
        const parsed = parseHcPayload(JSON.parse(line));
        if (isOk(parsed)) {
          found.push(parsed.value);
        }
      } catch {
        continue;
      }
    }
    return found;
  }
}

export function hcCoreSocketPath(): SocketPath {
  const direct = parseSocketPath(process.env[HC_SOCKET_ENV]);
  if (isOk(direct)) {
    return direct.value;
  }
  const runtime = parseNonEmptyText(process.env[HC_RUNTIME_ENV]);
  const root = isOk(runtime) ? runtime.value : join(HC_RUN_ROOT, String(process.getuid?.() ?? 0));
  const session = parseNonEmptyText(process.env[HC_SESSION_ENV]);
  const name = isOk(session) ? session.value : HC_DEFAULT_SESSION;
  return must(parseSocketPath(join(root, HC_SOCKET_FOLDER, `${name}${HC_SOCKET_SUFFIX}`)));
}

export function nextBackoff(failures: Count, base: Duration, cap: Duration): Duration {
  return duration(Math.min(cap, base * 2 ** Math.min(failures, 20)));
}

export function parseHcSnapshot(input: unknown): Result<HcSnapshot, ParseFailure> {
  if (!isFields(input)) {
    return err(NOT_A_ROW);
  }
  const seq = parseCount(input[HcField.Seq]);
  const rows = input[HcField.Terminals];
  if (isErr(seq) || !Array.isArray(rows)) {
    return err(NOT_A_ROW);
  }
  const terminals = rows.flatMap((row): HcPayload[] => {
    const payload = parseHcPayload(row);
    return isOk(payload) ? [payload.value] : [];
  });
  return ok({ seq: seq.value, terminals });
}

export function parseHcCoreHello(input: unknown): Result<HcCoreHello, ParseFailure> {
  if (!isFields(input)) {
    return err(NOT_A_ROW);
  }
  const generation = parseCount(input[HcField.Generation]);
  const version = parseText(input[HcField.Version]);
  const names = input[HcField.Methods];
  if (isErr(generation) || isErr(version) || !Array.isArray(names)) {
    return err(NOT_A_ROW);
  }
  const methods = names.flatMap((name): NonEmptyText[] => {
    const method = parseNonEmptyText(name);
    return isOk(method) ? [method.value] : [];
  });
  return ok({ version: version.value, methods, generation: generation.value });
}

export function parseHcFault(id: HcCallId, error: unknown): Result<HcFault, ParseFailure> {
  if (!isFields(error)) {
    return err(NOT_A_ROW);
  }
  const code = parseRpcCode(error[HcField.Code]);
  const message = parseText(error[HcField.Message]);
  const data = error[HcField.Data];
  const reason = parseText(isFields(data) ? data[HcField.Kind] : '');
  if (isErr(code) || isErr(message) || isErr(reason)) {
    return err(NOT_A_ROW);
  }
  return ok({ kind: HcKind.Fault, id, code: code.value, reason: reason.value, message: message.value });
}

export function parseHcReply(input: unknown): Result<HcReply | HcOdd | HcFault, ParseFailure> {
  if (!isFields(input)) {
    return err(NOT_A_ROW);
  }
  const id = parseHcCallId(input[HcField.Id]);
  if (isErr(id)) {
    return id;
  }
  if (Object.hasOwn(input, HcField.Error)) {
    return parseHcFault(id.value, input[HcField.Error]);
  }
  if (!Object.hasOwn(input, HcField.Result)) {
    return err(NOT_A_ROW);
  }
  const result = parseHcPayload(input[HcField.Result]);
  return ok(isOk(result) ? { kind: HcKind.Reply, id: id.value, result: result.value } : { kind: HcKind.Odd, id: id.value });
}

export function parseHcEvent(input: unknown): Result<HcEvent, ParseFailure> {
  if (!isFields(input)) {
    return err(NOT_A_ROW);
  }
  const seq = parseCount(input[HcField.Seq]);
  const type = parseNonEmptyText(input[HcField.Type]);
  const terminal = parseNonEmptyText(input[HcField.Terminal]);
  const data = parseHcPayload(input[HcField.Data]);
  if (isErr(seq) || isErr(type)) {
    return err(NOT_A_ROW);
  }
  return ok({ kind: HcKind.Event, seq: seq.value, terminal: isOk(terminal) ? terminal.value : null, type: type.value, data: isOk(data) ? data.value : NO_DATA });
}

export function parseHcHeartbeat(input: unknown): Result<HcHeartbeat, ParseFailure> {
  const seq = parseCount(isFields(input) ? input[HcField.Seq] : undefined);
  return isErr(seq) ? seq : ok({ kind: HcKind.Heartbeat, seq: seq.value });
}

export function parseHcMissed(input: unknown): Result<HcMissed, ParseFailure> {
  const snapshot = parseHcSnapshot(input);
  return isErr(snapshot) ? snapshot : ok({ kind: HcKind.Missed, snapshot: snapshot.value });
}

const NOTIFICATIONS: Readonly<Record<HcNotificationMethod, (params: unknown) => Result<HcNotification, ParseFailure>>> = {
  [HcNotificationMethod.Event]: parseHcEvent,
  [HcNotificationMethod.Heartbeat]: parseHcHeartbeat,
  [HcNotificationMethod.Missed]: parseHcMissed,
};

function isNotificationMethod(method: unknown): method is HcNotificationMethod {
  return isString(method) && Object.hasOwn(NOTIFICATIONS, method);
}

export function parseHcNotification(method: unknown, params: unknown): Result<HcNotification, ParseFailure> {
  return isNotificationMethod(method) ? NOTIFICATIONS[method](params) : err(NOT_A_ROW);
}

export function parseHcCoreMessage(input: unknown): Result<HcCoreMessage, ParseFailure> {
  if (!isFields(input)) {
    return err(NOT_A_ROW);
  }
  return Object.hasOwn(input, HcField.Method) ? parseHcNotification(input[HcField.Method], input[HcField.Params]) : parseHcReply(input);
}
