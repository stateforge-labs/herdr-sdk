// Role: the /effect entry's error mapping over real errors from the fake: a refusal, an unreachable socket and a timeout become the tagged shapes.
// Informs HERDR-ADR-0004 (Effect as a wrapper over the core) and plan 3.7 (error table); cross-layer test. The Herdr service (layer) is not built yet (amendment A1), so only the mapping is exercised.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect, Method } from '../../src/index.ts';
import { EffectErrorTag, toTaggedError } from '../../src/effect.ts';
import { withFake } from '../support/fake.ts';
import { rejectionOf } from '../support/rejection.ts';

describe('/effect error mapping over the fake', () => {
  test('a refusal from the server maps to HerdrRefused with its method and code', async () => {
    await withFake({}, async (fake) => {
      fake.fail(Method.PaneList, { code: 'pane_not_found', message: 'no such pane' });
      const client = await connect({ socketPath: fake.path });
      try {
        const tagged = toTaggedError(await rejectionOf(client.pane.list({})));
        assert.equal(tagged._tag, EffectErrorTag.Refused);
        assert.equal(tagged._tag === EffectErrorTag.Refused ? tagged.method : '', Method.PaneList);
        assert.equal(tagged._tag === EffectErrorTag.Refused ? tagged.code : '', 'pane_not_found');
      } finally {
        client.close();
      }
    });
  });

  test('a reply that never comes maps to HerdrUnavailable with isTimeout set', async () => {
    await withFake({}, async (fake) => {
      fake.silent(Method.PaneList);
      const client = await connect({ socketPath: fake.path, timeoutMs: 100 });
      try {
        const tagged = toTaggedError(await rejectionOf(client.pane.list({})));
        assert.equal(tagged._tag, EffectErrorTag.Unavailable);
        assert.equal(tagged._tag === EffectErrorTag.Unavailable ? tagged.isTimeout : false, true);
      } finally {
        client.close();
      }
    });
  });

  test('a socket that does not exist maps to HerdrUnavailable', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'herdr-effect-'));
    try {
      const tagged = toTaggedError(await rejectionOf(connect({ socketPath: join(dir, 'absent.sock') })));
      assert.equal(tagged._tag, EffectErrorTag.Unavailable);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
