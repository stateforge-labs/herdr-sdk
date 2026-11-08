// Role: member presence per entry, close() ends the transport, and watch() construction fails without session.snapshot.
// Informs HERDR-ADR-0005 (members per class set) and plan 3.4; slice P2b. Presence only where a member calls a P4a/P4b stub.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EntryKey, ErrorText, Presets } from '../../../../src/constants.ts';
import { ENTRY_METHODS, Method, PRESET_METHODS, ServerCapability } from '../../../../src/herdr/generated/index.ts';
import { HerdrTransportError } from '../../../../src/herdr/wire/errors.ts';
import { allowedMethods } from '../../../../src/herdr/client/scoped/allowed-methods.ts';
import { composeClient, composeOrClose, ENTRY_MEMBERS, PRESET_MEMBERS } from '../../../../src/herdr/client/scoped/compose.ts';
import type { CoreClient } from '../../../../src/herdr/client/types.ts';
import { rejectionOf } from '../../../support/rejection.ts';
import { stubCore } from './support/stub-core.ts';

// The record of which members a composed client has, as plain booleans.
function membersOf(client: object): Record<string, boolean> {
  return {
    call: 'call' in client,
    events: 'events' in client,
    watch: 'watch' in client,
    hold: 'hold' in client,
  };
}

function compose(core: CoreClient, entry: EntryKey): object {
  return composeClient<object>(core, allowedMethods(ENTRY_METHODS[entry]), ENTRY_MEMBERS[entry]);
}

describe('composeClient members', () => {
  test('connect() and connectAdmin() entries have call, events.subscribe, watch and hold', () => {
    for (const entry of [EntryKey.client, EntryKey.admin] as const) {
      const client = compose(stubCore().core, entry);
      assert.deepEqual(membersOf(client), { call: true, events: true, watch: true, hold: true }, entry);
    }
  });

  test('the admin entry has server.stop as a tree leaf', () => {
    const client = compose(stubCore().core, EntryKey.admin) as { server: { stop: unknown } };
    assert.equal(typeof client.server.stop, 'function');
  });

  test('the read-only entries stream but have no call() and no hold()', () => {
    for (const entry of [EntryKey.readOnly, EntryKey.readOnlyContent] as const) {
      const client = compose(stubCore().core, entry);
      assert.deepEqual(membersOf(client), { call: false, events: true, watch: true, hold: false }, entry);
    }
  });

  test('the prompt entry has no streams, no call() and no hold()', () => {
    const client = compose(stubCore().core, EntryKey.prompt);
    assert.deepEqual(membersOf(client), { call: false, events: false, watch: false, hold: false });
  });

  test('the preset form has no streams and no call()', () => {
    const client = composeClient<object>(
      stubCore().core,
      allowedMethods(PRESET_METHODS[Presets.SessionsReader]),
      PRESET_MEMBERS,
    );
    assert.deepEqual(membersOf(client), { call: false, events: false, watch: false, hold: false });
  });

  test('every client carries capabilities, serverInfo and close', () => {
    const { core } = stubCore({ [ServerCapability.HealthCheck]: true });
    const client = compose(core, EntryKey.client) as { capabilities: object; serverInfo: object; close: unknown };
    assert.equal(client.capabilities, core.capabilities);
    assert.equal(client.serverInfo, core.serverInfo);
    assert.equal(typeof client.close, 'function');
  });

  test('close() aborts transport.closed, which every stream of the client listens to', () => {
    const { core, controller } = stubCore();
    const client = compose(core, EntryKey.client) as { close: () => void };
    assert.equal(controller.signal.aborted, false);
    client.close();
    assert.equal(controller.signal.aborted, true);
  });

  test('call() sends an allowed method through the core', async () => {
    const { core, calls } = stubCore();
    const client = compose(core, EntryKey.client) as { call: (m: Method, p: object) => Promise<unknown> };
    await client.call(Method.PaneList, {});
    assert.equal(calls[0]?.method, Method.PaneList);
  });

  test('call() refuses a method outside the entry before sending', async () => {
    const { core, calls } = stubCore();
    const client = compose(core, EntryKey.client) as { call: (m: Method, p: object) => Promise<unknown> };
    const error = await rejectionOf(client.call(Method.ServerStop, {}));
    assert.ok(error instanceof HerdrTransportError);
    assert.equal(calls.length, 0);
  });

  test('a watch on a list without session.snapshot fails at construction', async () => {
    const { core } = stubCore();
    const narrow = allowedMethods(ENTRY_METHODS[EntryKey.readOnly], { methods: [Method.AgentList] });
    const error = await rejectionOf(Promise.resolve().then(() => composeClient<object>(core, narrow, ENTRY_MEMBERS[EntryKey.readOnly])));
    assert.ok(error instanceof HerdrTransportError);
  });

  test('a method list without events.subscribe has no events.subscribe and fails at construction (watch is built on it)', async () => {
    const { core } = stubCore();
    const narrow = allowedMethods(ENTRY_METHODS[EntryKey.readOnly], { methods: [Method.AgentList, Method.SessionSnapshot, Method.EventsWait] });
    const error = await rejectionOf(Promise.resolve().then(() => composeClient<object>(core, narrow, ENTRY_MEMBERS[EntryKey.readOnly])));
    assert.ok(error instanceof HerdrTransportError);
    assert.equal(error.message, ErrorText.NotAllowed(Method.EventsSubscribe));
  });

  test('a watch on a list with events.subscribe but without session.snapshot fails at construction, naming session.snapshot', async () => {
    const { core } = stubCore();
    const narrow = allowedMethods(ENTRY_METHODS[EntryKey.readOnly], { methods: [Method.EventsSubscribe] });
    const error = await rejectionOf(Promise.resolve().then(() => composeClient<object>(core, narrow, ENTRY_MEMBERS[EntryKey.readOnly])));
    assert.ok(error instanceof HerdrTransportError);
    assert.equal(error.message, ErrorText.NotAllowed(Method.SessionSnapshot));
  });

  test('a refused watch is refused before any stream is loaded: the call returns synchronously with the error', () => {
    const { core } = stubCore();
    const narrow = allowedMethods(ENTRY_METHODS[EntryKey.readOnly], { methods: [Method.AgentList] });
    assert.throws(() => composeClient<object>(core, narrow, ENTRY_MEMBERS[EntryKey.readOnly]), HerdrTransportError);
  });

  test('a method list with events.subscribe and session.snapshot composes the subscribe member', () => {
    const { core } = stubCore();
    const narrow = allowedMethods(ENTRY_METHODS[EntryKey.readOnly], { methods: [Method.EventsSubscribe, Method.SessionSnapshot] });
    const client = composeClient<object>(core, narrow, ENTRY_MEMBERS[EntryKey.readOnly]) as { events: { subscribe: unknown } };
    assert.equal(typeof client.events.subscribe, 'function');
  });

  test('composeOrClose closes the core when composition refuses, so its transport is aborted', async () => {
    const { core, controller } = stubCore();
    const narrow = allowedMethods(ENTRY_METHODS[EntryKey.readOnly], { methods: [Method.AgentList] });
    const error = await rejectionOf(Promise.resolve().then(() => composeOrClose<object>(core, narrow, ENTRY_MEMBERS[EntryKey.readOnly])));
    assert.ok(error instanceof HerdrTransportError);
    assert.equal(controller.signal.aborted, true);
  });
});
