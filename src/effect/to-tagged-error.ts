// Role: maps a Promise-core error to its Effect tagged error. S0 returns plain objects that match the shapes in effect/types.ts; S1 (after A1) builds the Data.TaggedError classes instead.
// Informs HERDR-ADR-0004 (Effect as a wrapper over the Promise core) and plan 3.7 (error table); contract in effect/types.ts (ToTaggedError).
import { EffectErrorTag, EffectFallbackMessage } from '../constants.ts';
import {
  HerdrError,
  HerdrTransportError,
  ProtocolMismatchError,
  SubscriptionEnded,
  UnsupportedByServerError,
} from '../wire/errors.ts';
import type {
  HerdrRefusedShape,
  HerdrTaggedError,
  HerdrUnavailableShape,
  HerdrUnsupportedShape,
  ProtocolMismatchShape,
  ToTaggedError,
} from './types.ts';

// A server refusal keeps its method, code and message.
function refused(error: HerdrError): HerdrRefusedShape {
  return { _tag: EffectErrorTag.Refused, method: error.method, code: error.code, message: error.message };
}

// A transport failure keeps its timeout flag and the original error as cause.
function transportFailure(error: HerdrTransportError): HerdrUnavailableShape {
  return { _tag: EffectErrorTag.Unavailable, message: error.message, cause: error, isTimeout: error.isTimeout };
}

// A protocol mismatch keeps both protocol numbers.
function protocolMismatch(error: ProtocolMismatchError): ProtocolMismatchShape {
  return {
    _tag: EffectErrorTag.ProtocolMismatch,
    message: error.message,
    expected: error.expected,
    actual: error.actual,
  };
}

// A missing server capability keeps the method and the capability that was missing.
function unsupported(error: UnsupportedByServerError): HerdrUnsupportedShape {
  return {
    _tag: EffectErrorTag.Unsupported,
    message: error.message,
    method: error.method,
    capability: error.capability,
  };
}

// An ended subscription is unavailable, not a timeout; the original error is the cause.
function subscriptionEnded(error: SubscriptionEnded): HerdrUnavailableShape {
  return { _tag: EffectErrorTag.Unavailable, message: error.message, cause: error, isTimeout: false };
}

// Anything else is unavailable with the value as cause; its message is used when it has one.
function unknownFailure(value: unknown): HerdrUnavailableShape {
  const message = value instanceof Error && value.message ? value.message : EffectFallbackMessage.UnknownError;
  return { _tag: EffectErrorTag.Unavailable, message, cause: value, isTimeout: false };
}

// Dispatch order follows the table in effect/types.ts; the first matching class wins.
function mapError(error: unknown): HerdrTaggedError {
  if (error instanceof HerdrError) return refused(error);
  if (error instanceof HerdrTransportError) return transportFailure(error);
  if (error instanceof ProtocolMismatchError) return protocolMismatch(error);
  if (error instanceof UnsupportedByServerError) return unsupported(error);
  if (error instanceof SubscriptionEnded) return subscriptionEnded(error);
  return unknownFailure(error);
}

export const toTaggedError: ToTaggedError = (error) => mapError(error);
