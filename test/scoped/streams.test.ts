// Role: the stream factories receive exactly the client's resolved transport, its close signal and the real tree builder and allow-list.
// Informs plan 3.3 (never re-resolve the socket or timeout) and plan 3.6; slice P2b. The factories are spied on, so no stream is opened.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Method } from '../../src/generated/index.ts';
import { openDedicated } from '../../src/wire/dedicated.ts';
import { HerdrTransportError } from '../../src/wire/errors.ts';
import type { CreateHold, HoldDeps } from '../../src/client/held/types.ts';
import type { CreateSubscribe, Subscribe, SubscribeDeps } from '../../src/client/subscribe/types.ts';
import type { CreateWatch, WatchFn } from '../../src/client/watch/types.ts';
import { holdFor, subscribeFor, watchFor } from '../../src/client/scoped/streams.ts';
import { buildNamespaceTree } from '../../src/client/scoped/namespace-tree.ts';
import { allowedMethods } from '../../src/client/scoped/allowed-methods.ts';
import { stubCore, STUB_TIMEOUT_MS } from './support/stub-core.ts';

const unusedSubscribe: Subscribe = async () => {
  throw new Error('not opened in this test');
};

describe('subscribeFor', () => {
  test('receives the transport fields, the close signal and the dedicated opener', () => {
    const { core, controller } = stubCore();
    let received: SubscribeDeps | undefined;
    const spy: CreateSubscribe = (deps) => {
      received = deps;
      return unusedSubscribe;
    };
    subscribeFor(core.transport, spy);
    assert.equal(received?.socketPath, core.transport.socketPath);
    assert.equal(received?.timeoutMs, STUB_TIMEOUT_MS);
    assert.equal(received?.signal, controller.signal);
    assert.equal(received?.open, openDedicated);
  });
});

describe('watchFor', () => {
  test('passes the subscribe through to the watch factory', () => {
    let received: Subscribe | undefined;
    const spy: CreateWatch = (subscribe) => {
      received = subscribe;
      return (() => undefined) as unknown as WatchFn;
    };
    watchFor(unusedSubscribe, allowedMethods('readOnly'), spy);
    assert.equal(received, unusedSubscribe);
  });

  test('throws HerdrTransportError at construction when session.snapshot is not allowed', () => {
    assert.throws(
      () => watchFor(unusedSubscribe, allowedMethods('readOnly', { methods: [Method.AgentList] })),
      HerdrTransportError,
    );
  });
});

describe('holdFor', () => {
  test('receives the transport, the capabilities, the real tree builder and allow-list, and the close signal', () => {
    const { core, controller } = stubCore({ live_handoff: true });
    let received: HoldDeps | undefined;
    const spy: CreateHold = (deps) => {
      received = deps;
      return (() => undefined) as never;
    };
    holdFor(core, spy);
    assert.equal(received?.socketPath, core.transport.socketPath);
    assert.equal(received?.timeoutMs, STUB_TIMEOUT_MS);
    assert.equal(received?.capabilities, core.capabilities);
    assert.equal(received?.open, openDedicated);
    assert.equal(received?.buildTree, buildNamespaceTree);
    assert.equal(received?.allowedMethods, allowedMethods);
    assert.equal(received?.signal, controller.signal);
  });
});
