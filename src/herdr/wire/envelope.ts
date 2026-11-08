// Role: the JSON envelopes of the herdr socket: the request we write, the success and error replies we read, and their checks.
// Informs HERDR-ADR-0016 (W1 one request per connection, W3 error envelope with id "") and plan 3.1; ported from atalaya src/protocol/envelope.ts.
import { TypeofTag, WireField } from '../../constants.ts';
import type { ErrorBody, ResponseResult } from '../generated/index.ts';

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
