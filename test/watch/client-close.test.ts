// Role: checks that the client's close ends watch normally: the scripted subscribe ends its subscriptions when the shared client-closed signal aborts, and watch returns without resubscribing.
// Informs plan 3.3 and contract ClientBase.close (close aborts every stream of the client) and HERDR-ADR-0016; the plan 4b checklist row "client close ends watch and held".
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createWatch } from '../../src/client/watch/watch.ts';
import { recordingSleep } from './support/fake-sleep.ts';
import { scriptedSubscribe } from './support/scripted-subscribe.ts';

describe('client close', () => {
  test('watch ends normally when the client closes, and does not resubscribe', async () => {
    const clientClosed = new AbortController();
    const subs = scriptedSubscribe(clientClosed.signal);
    const sleep = recordingSleep();
    const iterator = createWatch(subs.subscribe)({ snapshot: async () => 'present', sleep: sleep.sleep })[Symbol.asyncIterator]();
    assert.equal((await iterator.next()).done, false);
    clientClosed.abort();
    assert.deepEqual(await iterator.next(), { value: undefined, done: true });
    assert.equal(subs.calls.length, 1);
    assert.deepEqual(sleep.delays, []);
  });
});
