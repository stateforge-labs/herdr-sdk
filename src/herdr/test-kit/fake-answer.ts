// Role: decides the answer to one request line: silence, a raw line, or an envelope (the checked params, a scripted step or failure, a scripted reply, the default, or the unknown-method error).
// Informs HERDR-ADR-0016 (W3: an unparseable request gets id "" and an error; W4: api.schema answers {}; F1, F3, F6) and plan 5; test-kit only.
// The order is first match wins. Silence and raw lines are test switches that come before herdr's own param check.
import { AnswerKind, Fake, FakeText, WireField } from '../../constants.ts';
import type { ErrorBody } from '../generated/index.ts';
import type { FakeScript, ScriptedStep } from './fake-script.ts';
import { defaultResultOf } from './fake-defaults.ts';
import { checkParams } from './fake-request-check.ts';
import type { PongSettings } from './fake-pong.ts';
import type { ReceivedRequest } from './types.ts';

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
