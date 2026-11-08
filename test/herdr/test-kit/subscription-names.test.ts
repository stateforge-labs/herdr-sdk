// Role: checks that every subscription type gets its own frames: a frame named for a type (or for its event kind) reaches the subscriber of that type and no other.
// Informs HERDR-ADR-0016 (W6: a per-pane frame reaches only its pane) and generated/names.ts (SubscriptionType, the event kind with its first "_" replaced by "."); new test.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NameSeparator, PER_PANE_SUBSCRIPTION_TYPES } from '../../../src/constants.ts';
import { EventKind, Method, SubscriptionType } from '../../../src/herdr/generated/index.ts';
import { encodeRequest } from '../../../src/herdr/wire/envelope.ts';
import { withFake } from '../../support/fake.ts';
import { linesAtLeast, openLineReader } from './support/lines.ts';

const PANE = 'pane-x';
const QUIET_MS = 150;

// The frame name of a subscription type: its event kind when one exists (pane.created is pane_created), else the type itself
// (pane.output_matched is named as a subscription type in its frame).
function frameNameOf(type: string): string {
  const eventSpelling = type.replace(NameSeparator.Subscription, NameSeparator.Event);
  return (Object.values(EventKind) as string[]).includes(eventSpelling) ? eventSpelling : type;
}

function quiet(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, QUIET_MS));
}

describe('every subscription type has its own frames', () => {
  test('a frame named for a type reaches only the subscriber of that type, and nobody else', async () => {
    await withFake({}, async (fake) => {
      const types: readonly string[] = Object.values(SubscriptionType);
      const readers = types.map((type, index) => {
        const reader = openLineReader(fake.path);
        const perPane = (PER_PANE_SUBSCRIPTION_TYPES as readonly string[]).includes(type);
        reader.write(encodeRequest(`s${index}`, Method.EventsSubscribe, { subscriptions: [perPane ? { type, pane_id: PANE } : { type }] }));
        return reader;
      });
      await Promise.all(readers.map((reader) => linesAtLeast(reader, 1)));
      types.forEach((type) => {
        const frame = { event: frameNameOf(type), data: { pane_id: PANE } };
        // The push is typed loosely: the fake routes it by its name, and a name it knows goes to its own type only.
        fake.push(frame);
      });
      await quiet();
      readers.forEach((reader, index) => {
        assert.equal(reader.lines.length, 2, `subscriber of ${types[index] ?? ''} got ${reader.lines.length - 1} frames`);
        assert.equal(JSON.parse(reader.lines[1] ?? '').event, frameNameOf(types[index] ?? ''));
        reader.destroy();
      });
    });
  });
});
