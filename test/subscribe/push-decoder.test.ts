// Role: checks decodePush(): every generated kind decodes as known, an unknown kind becomes an UnknownFrame (with rawEvent and raw), and a line without a valid envelope is not a push.
// Informs HERDR-ADR-0016 (P3 unknown kinds surfaced, P4 envelope-only validation) and plan 3.6; new test.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { UNKNOWN_EVENT } from '../../src/constants.ts';
import { EventKind, SubscriptionEventKind } from '../../src/generated/index.ts';
import { decodePush } from '../../src/wire/push-decoder.ts';
import type { UnknownFrame } from '../../src/wire/types.ts';
import { unknownKindLine } from './support/frames.ts';

const FUTURE_KIND = 'future_kind';

describe('decodePush', () => {
  for (const kind of [...Object.values(EventKind), ...Object.values(SubscriptionEventKind)]) {
    test(`decodes the generated kind ${kind} as known`, () => {
      const line = { event: kind, data: {} };
      assert.equal(decodePush(line), line);
    });
  }

  test('an unknown kind becomes an UnknownFrame with the raw event and the whole line', () => {
    const line = unknownKindLine(FUTURE_KIND);
    const frame = decodePush(line) as UnknownFrame;
    assert.equal(frame.event, UNKNOWN_EVENT);
    assert.equal(frame.rawEvent, FUTURE_KIND);
    assert.equal(frame.raw, line);
  });

  test('a line without an event is not a push', () => {
    assert.equal(decodePush({ data: {} }), undefined);
  });

  test('a non-string event is not a push', () => {
    assert.equal(decodePush({ event: 5, data: {} }), undefined);
  });

  test('a line without data is not a push', () => {
    assert.equal(decodePush({ event: EventKind.PaneExited }), undefined);
  });

  test('a null or array line is not a push', () => {
    assert.equal(decodePush(null as unknown as object), undefined);
    assert.equal(decodePush([] as unknown as object), undefined);
  });
});
