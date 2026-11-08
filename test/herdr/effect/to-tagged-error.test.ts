// Role: checks the Promise-error to tagged-error table of /effect: one row per core error class, plus a plain Error, a thrown string and undefined.
// Informs HERDR-ADR-0004 and plan 3.7 (error table); covers lane P6a slice S0 (no effect import).
import { describe, expect, test } from 'bun:test';
import { EffectErrorTag, EffectFallbackMessage } from '../../../src/constants.ts';
import { toTaggedError } from '../../../src/herdr/effect/to-tagged-error.ts';
import type { HerdrTaggedError } from '../../../src/herdr/effect/types.ts';
import {
  HerdrError,
  HerdrTransportError,
  ProtocolMismatchError,
  SubscriptionEnded,
  UnsupportedByServerError,
} from '../../../src/herdr/wire/errors.ts';
import { Method, ServerCapability } from '../../../src/herdr/generated/index.ts';

// Fails the test unless the value has the wanted tag, and narrows its type for the field checks that follow.
function expectTag<Tag extends HerdrTaggedError['_tag']>(
  value: HerdrTaggedError,
  tag: Tag,
): asserts value is Extract<HerdrTaggedError, { _tag: Tag }> {
  if (value._tag !== tag) throw new Error(`expected tag ${tag}, got ${value._tag}`);
}

describe('toTaggedError: server refusal', () => {
  test('HerdrError becomes HerdrRefused with method, code and message', () => {
    const error = HerdrError.from('ping', { code: 'bad', message: 'nope' });
    const tagged = toTaggedError(error);
    expectTag(tagged, EffectErrorTag.Refused);
    expect(tagged.message).toBe('ping: nope [bad]');
    expect(tagged).not.toBe(error);
    expect({ ...tagged }).toEqual({
      _tag: EffectErrorTag.Refused,
      method: 'ping',
      code: 'bad',
      message: 'ping: nope [bad]',
    });
  });
});

describe('toTaggedError: transport and subscription', () => {
  test('HerdrTransportError (timeout) becomes HerdrUnavailable with isTimeout true and the error as cause', () => {
    const error = new HerdrTransportError('late', { isTimeout: true });
    const tagged = toTaggedError(error);
    expectTag(tagged, EffectErrorTag.Unavailable);
    expect(tagged.isTimeout).toBe(true);
    expect(tagged.cause).toBe(error);
    expect(tagged.message).toBe('late');
  });

  test('HerdrTransportError (not a timeout) becomes HerdrUnavailable with isTimeout false', () => {
    const error = new HerdrTransportError('boom');
    const tagged = toTaggedError(error);
    expectTag(tagged, EffectErrorTag.Unavailable);
    expect(tagged.isTimeout).toBe(false);
    expect(tagged.cause).toBe(error);
  });

  test('SubscriptionEnded becomes HerdrUnavailable, never a timeout, with the error as cause', () => {
    const error = new SubscriptionEnded(Method.EventsSubscribe);
    const tagged = toTaggedError(error);
    expectTag(tagged, EffectErrorTag.Unavailable);
    expect(tagged.isTimeout).toBe(false);
    expect(tagged.cause).toBe(error);
    expect(tagged.message).toBe(error.message);
  });
});

describe('toTaggedError: protocol and capability', () => {
  test('ProtocolMismatchError becomes ProtocolMismatch with both protocol numbers', () => {
    const error = new ProtocolMismatchError(22, 21);
    const tagged = toTaggedError(error);
    expectTag(tagged, EffectErrorTag.ProtocolMismatch);
    expect(tagged.expected).toBe(22);
    expect(tagged.actual).toBe(21);
    expect(tagged.message).toBe(error.message);
  });

  test('UnsupportedByServerError becomes HerdrUnsupported with method and capability', () => {
    const error = new UnsupportedByServerError(Method.ServerLiveHandoff, ServerCapability.LiveHandoff);
    const tagged = toTaggedError(error);
    expectTag(tagged, EffectErrorTag.Unsupported);
    expect(tagged.method).toBe(Method.ServerLiveHandoff);
    expect(tagged.capability).toBe(ServerCapability.LiveHandoff);
    expect(tagged.message).toBe(error.message);
  });
});

describe('toTaggedError: unknown values', () => {
  test('a plain Error becomes HerdrUnavailable with its message and the error as cause', () => {
    const error = new Error('something else');
    const tagged = toTaggedError(error);
    expectTag(tagged, EffectErrorTag.Unavailable);
    expect(tagged.message).toBe('something else');
    expect(tagged.cause).toBe(error);
    expect(tagged.isTimeout).toBe(false);
  });

  test('a thrown string becomes HerdrUnavailable with the fallback message and the string as cause', () => {
    const tagged = toTaggedError('bare string');
    expectTag(tagged, EffectErrorTag.Unavailable);
    expect(tagged.message).toBe(EffectFallbackMessage.UnknownError);
    expect(tagged.cause).toBe('bare string');
    expect(tagged.isTimeout).toBe(false);
  });

  test('undefined becomes HerdrUnavailable with the fallback message and undefined as cause', () => {
    const tagged = toTaggedError(undefined);
    expectTag(tagged, EffectErrorTag.Unavailable);
    expect(tagged.message).toBe(EffectFallbackMessage.UnknownError);
    expect(tagged.cause).toBeUndefined();
    expect(tagged.isTimeout).toBe(false);
  });
});
