// Role: checks hold(): one connection for many calls, close (idempotent, also through `await using`), the server close, the capability gate, the client close and the caller's signal, serialised calls, and the per-call timeout fallback.
// Informs HERDR-ADR-0007 (held connections), HERDR-ADR-0016 (W1 one request per connection) and plan 3.6; the plan 4b checklist rows "held stays open then closes" and "client close ends held".
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CAPABILITIES, HeldText } from '../../../../src/constants.ts';
import { createHold } from '../../../../src/herdr/client/held/hold.ts';
import type { HoldDeps } from '../../../../src/herdr/client/held/types.ts';
import type { ClientCapabilities } from '../../../../src/herdr/client/types.ts';
import { Method } from '../../../../src/herdr/generated/index.ts';
import { HerdrTransportError, UnsupportedByServerError } from '../../../../src/herdr/wire/errors.ts';
import { rejectionOf } from '../../../support/rejection.ts';
import { waitUntil } from '../../../support/wait.ts';
import { memoryDedicated, type Answer } from './support/memory-dedicated.ts';
import { tinyAllowedMethods, tinyTree } from './support/tiny-tree.ts';

const TIMEOUT_MS = 5000;
const WAIT_MS = 1000;

interface Harness {
  readonly dedicated: ReturnType<typeof memoryDedicated>;
  readonly clientClosed: AbortController;
  readonly deps: HoldDeps;
}

function harness(answer?: Answer, capabilities: ClientCapabilities = DEFAULT_CAPABILITIES): Harness {
  const dedicated = memoryDedicated(answer);
  const clientClosed = new AbortController();
  const deps: HoldDeps = {
    socketPath: '/unused/herdr.sock',
    timeoutMs: TIMEOUT_MS,
    capabilities,
    open: dedicated.open,
    buildTree: tinyTree,
    allowedMethods: tinyAllowedMethods,
    signal: clientClosed.signal,
  };
  return { dedicated, clientClosed, deps };
}

describe('hold', () => {
  test('one connection serves many calls, and the requests go over it in order', async () => {
    const { dedicated, deps } = harness();
    const held = await createHold(deps)();
    await held.client.window_title.set({ title: 'one' });
    await held.client.window_title.clear({});
    await held.client_shell.surface.set({ active: true });
    assert.equal(dedicated.connections.length, 1);
    const [connection] = dedicated.connections;
    assert.deepEqual(
      connection?.requests.map((request) => request.method),
      [Method.ClientWindowTitleSet, Method.ClientWindowTitleClear, Method.ClientShellSurfaceSet],
    );
    await held.close();
  });

  test('close() destroys the connection and is idempotent; `await using` closes it too', async () => {
    const { dedicated, deps } = harness();
    const held = await createHold(deps)();
    await Promise.all([held.close(), held.close()]);
    assert.equal(dedicated.connections[0]?.destroyed, true);
    await held.close();

    const scoped = await createHold(deps)();
    {
      await using handle = scoped;
      assert.equal(handle.ended instanceof Promise, true);
    }
    assert.equal(dedicated.connections[1]?.destroyed, true);
  });

  test('a server close resolves ended, and every later call rejects with HerdrTransportError', async () => {
    const { dedicated, deps } = harness();
    const held = await createHold(deps)();
    dedicated.connections[0]?.serverClose();
    await held.ended;
    const error = await rejectionOf(held.client.window_title.set({ title: 'late' }));
    assert.ok(error instanceof HerdrTransportError);
    assert.equal(error.message, HeldText.Ended(Method.ClientWindowTitleSet));
    assert.equal(dedicated.connections[0]?.requests.length, 0);
  });

  test('a method whose capability the server did not advertise rejects before anything is sent', async () => {
    const { dedicated, deps } = harness(undefined, {});
    const held = await createHold(deps)();
    const error = await rejectionOf(held.server.ssh_agent.register({ socket_path: '/run/agent.sock' }));
    assert.ok(error instanceof UnsupportedByServerError);
    assert.equal(dedicated.connections[0]?.requests.length, 0);
    await held.close();
  });

  test('aborting the client closes every held connection of the client', async () => {
    const { dedicated, clientClosed, deps } = harness();
    const first = await createHold(deps)();
    const second = await createHold(deps)();
    clientClosed.abort();
    await Promise.all([first.ended, second.ended]);
    assert.equal(dedicated.connections[0]?.destroyed, true);
    assert.equal(dedicated.connections[1]?.destroyed, true);
  });

  test('aborting the signal given to hold() closes that connection only', async () => {
    const { dedicated, deps } = harness();
    const caller = new AbortController();
    const held = await createHold(deps)({ signal: caller.signal });
    const other = await createHold(deps)();
    caller.abort();
    await held.ended;
    assert.equal(dedicated.connections[0]?.destroyed, true);
    assert.equal(dedicated.connections[1]?.destroyed, false);
    await other.close();
  });

  test('parallel calls are serialised: the second request is sent only after the first is answered', async () => {
    let release: (() => void) | undefined;
    const held1 = new Promise<unknown>((resolve) => {
      release = () => resolve({});
    });
    const { dedicated, deps } = harness(async (method) => (method === Method.ClientWindowTitleSet ? held1 : {}));
    const held = await createHold(deps)();
    const first = held.client.window_title.set({ title: 'a' });
    const second = held.client.window_title.clear({});
    await waitUntil(() => dedicated.connections[0]?.requests.length === 1, WAIT_MS);
    assert.equal(dedicated.connections[0]?.requests.length, 1, 'the second call waits');
    release?.();
    await Promise.all([first, second]);
    assert.equal(dedicated.connections[0]?.requests.length, 2);
    await held.close();
  });

  test('a call queued behind a pending one rejects at once when its own signal aborts, and is never sent', async () => {
    let release: (() => void) | undefined;
    const held1 = new Promise<unknown>((resolve) => {
      release = () => resolve({});
    });
    const { dedicated, deps } = harness(async (method) => (method === Method.ClientWindowTitleSet ? held1 : {}));
    const held = await createHold(deps)();
    const first = held.client.window_title.set({ title: 'a' });
    const caller = new AbortController();
    const second = held.client.window_title.clear({}, { signal: caller.signal });
    await waitUntil(() => dedicated.connections[0]?.requests.length === 1, WAIT_MS);
    caller.abort();
    assert.equal(await rejectionOf(second), caller.signal.reason);
    release?.();
    await first;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(dedicated.connections[0]?.requests.length, 1, 'the aborted call was never sent');
    await held.close();
  });

  test('a call whose signal is already aborted rejects without sending anything', async () => {
    const { dedicated, deps } = harness();
    const held = await createHold(deps)();
    const caller = new AbortController();
    caller.abort();
    assert.equal(await rejectionOf(held.client.window_title.clear({}, { signal: caller.signal })), caller.signal.reason);
    assert.equal(dedicated.connections[0]?.requests.length, 0);
    await held.close();
  });

  test('a call without its own timeout uses the client timeout; a per-call timeout overrides it', async () => {
    const { dedicated, deps } = harness();
    const held = await createHold(deps)();
    await held.client.window_title.clear({});
    await held.client.window_title.clear({}, { timeoutMs: 250 });
    const [connection] = dedicated.connections;
    assert.equal(connection?.requests[0]?.options?.timeoutMs, TIMEOUT_MS);
    assert.equal(connection?.requests[1]?.options?.timeoutMs, 250);
    await held.close();
  });
});
