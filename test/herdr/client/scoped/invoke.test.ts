// Role: the single send path of a client: refuses a method outside the allow-list before sending, and gives a long-poll call its bounds check and timeout.
// Informs HERDR-ADR-0005 (runtime allow-list), HERDR-ADR-0007 and plan 3.6; slice P2b. The P4a helpers are stubbed, so this runs before P4a lands.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { HerdrTransportError } from '../../../../src/herdr/errors.ts';
import { Method } from '../../../../src/herdr/generated/index.ts';
import { createInvoke, type InvokeDeps } from '../../../../src/herdr/client/scoped.ts';
import { rejectionOf } from '../../../support/rejection.ts';
import { stubCore, STUB_TIMEOUT_MS } from './support/stub-core.ts';

const LONG_POLL_MS = 777;

function stubDeps(): { deps: InvokeDeps; bounds: string[]; timeouts: { method: string; fallback: number | undefined }[] } {
  const bounds: string[] = [];
  const timeouts: { method: string; fallback: number | undefined }[] = [];
  const deps: InvokeDeps = {
    assertLongPollBounds: (method) => {
      bounds.push(method);
    },
    requestTimeoutMs: (method, _params, fallback) => {
      timeouts.push({ method, fallback });
      return LONG_POLL_MS;
    },
  };
  return { deps, bounds, timeouts };
}

describe('createInvoke', () => {
  test('a method outside the allow-list rejects with HerdrTransportError and nothing is sent', async () => {
    const { core, calls } = stubCore();
    const invoke = createInvoke(core, new Set([Method.PaneList]));
    const error = await rejectionOf(invoke(Method.ServerStop, {}));
    assert.ok(error instanceof HerdrTransportError);
    assert.equal(calls.length, 0);
  });

  test('an allowed non-long-poll method sends with the caller options and never touches the long-poll helpers', async () => {
    const { core, calls } = stubCore();
    const { deps, bounds, timeouts } = stubDeps();
    const invoke = createInvoke(core, new Set([Method.PaneList]), deps);
    await invoke(Method.PaneList, {}, { signal: undefined });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.method, Method.PaneList);
    assert.equal('timeoutMs' in (calls[0]?.options ?? {}), false, 'no timeout is added');
    assert.deepEqual(bounds, []);
    assert.deepEqual(timeouts, []);
  });

  test('a long-poll call checks its bounds, takes the timeout from the helper and sends it', async () => {
    const { core, calls } = stubCore();
    const { deps, bounds, timeouts } = stubDeps();
    const invoke = createInvoke(core, new Set([Method.AgentWait]), deps);
    await invoke(Method.AgentWait, { target: 'reviewer', timeout_ms: 1_000 });
    assert.deepEqual(bounds, [Method.AgentWait]);
    assert.deepEqual(timeouts, [{ method: Method.AgentWait, fallback: STUB_TIMEOUT_MS }]);
    assert.equal(calls[0]?.options.timeoutMs, LONG_POLL_MS);
    assert.deepEqual(calls[0]?.params, { target: 'reviewer', timeout_ms: 1_000 });
  });

  test('a long-poll call keeps the caller signal next to the computed timeout', async () => {
    const { core, calls } = stubCore();
    const { deps } = stubDeps();
    const controller = new AbortController();
    const invoke = createInvoke(core, new Set([Method.AgentWait]), deps);
    await invoke(Method.AgentWait, { target: 'reviewer', timeout_ms: 1_000 }, { signal: controller.signal });
    assert.equal(calls[0]?.options.signal, controller.signal);
    assert.equal(calls[0]?.options.timeoutMs, LONG_POLL_MS);
  });

  test('a long-poll call keeps a timeoutMs the caller set: the call option wins over the computed one', async () => {
    const { core, calls } = stubCore();
    const { deps } = stubDeps();
    const invoke = createInvoke(core, new Set([Method.AgentWait]), deps);
    await invoke(Method.AgentWait, { target: 'reviewer', timeout_ms: 1_000 }, { timeoutMs: 5 });
    assert.equal(calls[0]?.options.timeoutMs, 5);
  });

  test('a long-poll call that fails its bounds check is never sent', async () => {
    const { core, calls } = stubCore();
    const deps: InvokeDeps = {
      assertLongPollBounds: () => {
        throw new HerdrTransportError('out of range');
      },
      requestTimeoutMs: () => LONG_POLL_MS,
    };
    const invoke = createInvoke(core, new Set([Method.AgentWait]), deps);
    const error = await rejectionOf(invoke(Method.AgentWait, { target: 'r', timeout_ms: 1 }));
    assert.ok(error instanceof HerdrTransportError);
    assert.equal(calls.length, 0);
  });
});
