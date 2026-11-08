// Role: the wire codec: request ids, the JSON-RPC envelopes, the NDJSON line splitter, the protocol policy, the typed params/result helpers and the per-call hook.
// Informs HERDR-ADR-0017, HERDR-ADR-0002, plan 3.2, HERDR-ADR-0016, plan 3.1, plan 3, HERDR-ADR-0009, HERDR-ADR-0004, plan 3.3; merged by HERDR-ADR-0021 from typed.ts, id.ts, envelope.ts, line-splitter.ts, protocol-policy.ts, call-hook.ts.
import { PROTOCOL } from '../generated/index.ts';
import type { METHOD_RESULT, Method, MethodParams, ResponseResult, ResultByTag, ErrorBody } from '../generated/index.ts';
import { REQUEST_ID_PREFIX, TypeofTag, WireField, LINE_SEPARATOR, ProtocolPolicy, CallOutcome } from '../../constants.ts';
import { HerdrError } from '../errors.ts';
import type { CallEvent, OnCall } from './types.ts';
export type { CallEvent, OnCall } from './types.ts';

export type ParamsOf<M extends Method> = MethodParams[M];

export type ResultOf<M extends Method> = M extends keyof typeof METHOD_RESULT
  ? ResultByTag[(typeof METHOD_RESULT)[M]]
  : ResponseResult;

const FIRST_COUNT = 1;

let counter = 0;

export function nextId(prefix: string = REQUEST_ID_PREFIX): string {
  counter += FIRST_COUNT;
  return `${prefix}-${counter}-${Date.now().toString(36)}`;
}

export interface RequestEnvelope<M extends string = string, P = unknown> {
  id: string;
  method: M;
  params: P;
}

export interface SuccessEnvelope<R = ResponseResult> {
  id: string;
  result: R;
}

export interface ErrorEnvelope {
  id: string;
  error: ErrorBody;
}

export type ResponseEnvelope<R = ResponseResult> = SuccessEnvelope<R> | ErrorEnvelope;

export function isErrorEnvelope(envelope: object): envelope is ErrorEnvelope {
  return WireField.Error in envelope;
}

// A JSON object envelope: an object that is neither null nor an array.
export function isObject(value: unknown): value is object {
  return typeof value === TypeofTag.Object && value !== null && !Array.isArray(value);
}

// One request as a JSON line, without the trailing newline (the connection adds it).
export function encodeRequest(id: string, method: string, params: unknown): string {
  return JSON.stringify({ [WireField.Id]: id, [WireField.Method]: method, [WireField.Params]: params });
}

export class LineSplitter {
  private buffer = '';

  // Feeds one chunk and returns every complete, non-empty line it finished.
  push(chunk: string): string[] {
    const parts = (this.buffer + chunk).split(LINE_SEPARATOR);
    this.buffer = parts.pop() ?? '';
    return parts.filter((line) => line.length > 0);
  }

  // Text received after the last newline, not yet a line.
  get pending(): string {
    return this.buffer;
  }
}

export function isSupportedProtocol(
  actual: number,
  policy: ProtocolPolicy = ProtocolPolicy.Exact,
  expected: number = PROTOCOL,
): boolean {
  switch (policy) {
    case ProtocolPolicy.Exact:
      return actual === expected;
    case ProtocolPolicy.Minimum:
      return actual >= expected;
  }
}


export interface CallClassification {
  readonly outcome: CallOutcome;
  readonly code?: string;
}

// A server refusal is Refused with its code; everything else (timeout, abort, socket, malformed line) is Transport.
export function outcomeOf(error: unknown): CallClassification {
  if (error instanceof HerdrError) {
    return { outcome: CallOutcome.Refused, code: error.code };
  }
  return { outcome: CallOutcome.Transport };
}

// Runs the hook; a hook that throws changes nothing about the call.
export function reportCall(onCall: OnCall | undefined, event: CallEvent): void {
  if (onCall === undefined) {
    return;
  }
  try {
    onCall(event);
  } catch {
    // The observer is best effort: the caller's result or error is never replaced by a hook failure.
  }
}
