// Role: decides the answer to one request line: silence, a raw line, or an envelope (scripted, pong, or the unknown-method error).
// Informs HERDR-ADR-0016 (W3: an unparseable request gets id "" and an error; fake facts F1, F3, F6) and plan 5; test-kit only.
import { AnswerKind, Fake, FakeText, WireField } from '../constants.ts';
import { Method, type ErrorBody } from '../generated/index.ts';
import type { FakeScript } from './fake-script.ts';
import { pongBody, type PongSettings } from './fake-pong.ts';

export type Answer =
  | { readonly kind: typeof AnswerKind.Silent }
  | { readonly kind: typeof AnswerKind.Raw; readonly line: string }
  | { readonly kind: typeof AnswerKind.Envelope; readonly body: Record<string, unknown> };

const SILENT: Answer = { kind: AnswerKind.Silent };

export function answerFor(script: FakeScript, method: string, id: string, pong: PongSettings): Answer {
  if (script.isSilent(method)) {
    return SILENT;
  }
  const rawLine = script.rawLineOf(method);
  if (rawLine !== undefined) {
    return { kind: AnswerKind.Raw, line: rawLine };
  }
  const failure = script.failureOf(method);
  if (failure !== undefined) {
    return errorEnvelope(id, failure);
  }
  if (script.hasReply(method)) {
    return resultEnvelope(id, script.replyOf(method));
  }
  if (method === Method.Ping) {
    return resultEnvelope(id, pongBody(pong));
  }
  return errorEnvelope(id, { code: Fake.UnknownMethodCode, message: FakeText.UnknownMethod(method) });
}

// The answer to a line that is not a JSON object: herdr replies with the empty id and an error (W3).
export function invalidRequestAnswer(): Answer {
  return errorEnvelope('', { code: Fake.InvalidRequestCode, message: FakeText.InvalidRequest });
}

function resultEnvelope(id: string, result: unknown): Answer {
  return { kind: AnswerKind.Envelope, body: { [WireField.Id]: id, [WireField.Result]: result } };
}

function errorEnvelope(id: string, error: ErrorBody): Answer {
  return { kind: AnswerKind.Envelope, body: { [WireField.Id]: id, [WireField.Error]: error } };
}
