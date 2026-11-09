// Role: checks the herdr-core client: the roster fold (snapshot, events, missed, heartbeat) and its typed deltas.
// Informs HERDR-ADR-0020 (the herdr-core client); ported from the tab-recap hc-core-roster behaviour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { must, duration } from '../../src/core/kernel.ts';
import { CoreRoster } from '../../src/core/roster.ts';
import type { RosterDelta, RosterStep } from '../../src/core/roster.ts';
import { CoreEvents } from '../../src/core/events.ts';
import type { CoreEventsTiming, HcCoreFeed } from '../../src/core/events.ts';
import { HcKind } from '../../src/core/constants.ts';
import { parseHcAddress, parseHcTerminal } from '../../src/core/terminal.ts';
import type { HcAddress, HcTerminal } from '../../src/core/terminal.ts';
import { parseHcEvent, parseHcHeartbeat, parseHcMissed, parseHcPayload, parseHcSnapshot } from '../../src/core/wire.ts';
import type { HcHeartbeat, HcMissed, HcPayload, HcSnapshot } from '../../src/core/wire.ts';
import { FakeHcCore, agentTerminal, later, nextWithin, shellTerminal } from '../../src/core/test-kit/fake-core.ts';

const FAST: CoreEventsTiming = { backoffBase: duration(30), backoffCap: duration(120), silence: duration(150) };
const WAIT = 1500;

const row = (fields: object): HcPayload => must(parseHcPayload(fields));
const addr = (value: string): HcAddress => must(parseHcAddress(value));
const snapshotOf = (seq: number, terminals: readonly object[]): HcSnapshot => must(parseHcSnapshot({ seq, terminals }));
const missedOf = (seq: number, terminals: readonly object[]): HcMissed => must(parseHcMissed({ seq, terminals }));
const heartbeatOf = (seq: number): HcHeartbeat => must(parseHcHeartbeat({ seq }));
const eventOf = (seq: number, terminal: string | null, type: string, data: object) => must(parseHcEvent({ seq, terminal, type, data }));
const agent = (address: string, state: string, labels?: Record<string, string>): object => agentTerminal(address, state, labels);

function loaded(...rows: object[]): CoreRoster {
  const roster = new CoreRoster();
  roster.load(rows.map(row));
  return roster;
}

function kindsOf(deltas: readonly RosterDelta[]): string[] {
  return deltas.map((delta) => delta.kind);
}

function pairsOf(deltas: readonly RosterDelta[]): [string, string][] {
  return deltas.map((delta) => [delta.kind, delta.terminal.address]);
}

function onlyDelta(step: RosterStep): RosterDelta {
  assert.equal(step.deltas.length, 1, `expected one delta, got ${JSON.stringify(pairsOf(step.deltas))}`);
  const [delta] = step.deltas;
  assert.ok(delta !== undefined);
  return delta;
}

test('load seeds the table with agents only, while addresses() also lists the live shell', () => {
  const roster = loaded(agent('t1', 'working'), shellTerminal('t2'));
  assert.deepEqual([...roster.terminals.keys()], ['t1']);
  assert.deepEqual(roster.addresses(), ['t1', 't2']);
  assert.equal(roster.get(addr('t2')), null);
  assert.equal(roster.get(addr('t1'))?.status, 'working');
  assert.equal(roster.revision, 0);
  assert.equal(roster.seq, null);
});

test('load reports every row as added against an empty table, and a second load diffs against the first', () => {
  const roster = new CoreRoster();
  assert.deepEqual(kindsOf(roster.load([row(agent('t1', 'working'))])), ['added']);
  assert.deepEqual(kindsOf(roster.load([row(agent('t1', 'idle'))])), ['changed']);
  assert.equal(roster.revision, 0);
});

test('initial is true on the first fold that seeds the roster and false after', () => {
  const roster = new CoreRoster();
  const first = roster.fold({ kind: HcKind.Snapshot, snapshot: snapshotOf(10, [agent('t1', 'working')]) });
  assert.equal(first.initial, true);
  assert.deepEqual(kindsOf(first.deltas), ['added']);
  const beat = roster.fold(heartbeatOf(11));
  assert.equal(beat.initial, false);
});

test('a created event adds a row; the revision and seq follow the feed', () => {
  const roster = loaded(agent('t1', 'working'));
  const step = roster.fold(eventOf(11, 't3', 'created', agent('t3', 'idle')));
  assert.equal(step.revision, 1);
  assert.equal(step.seq, 11);
  assert.equal(step.initial, false);
  assert.equal(step.unknownType, null);
  const delta = onlyDelta(step);
  assert.equal(delta.kind, 'added');
  assert.equal(delta.terminal.address, 't3');
});

test('a status patch changes the row and carries the row it replaced', () => {
  const roster = loaded(agent('t1', 'working'));
  const delta = onlyDelta(roster.fold(eventOf(12, 't1', 'status', { status: { app: 'claude-code', state: 'idle' } })));
  assert.equal(delta.kind, 'changed');
  assert.ok(delta.kind === 'changed');
  assert.equal(delta.before.status, 'working');
  assert.equal(delta.terminal.status, 'idle');
});

test('a status that becomes null removes the terminal from the table', () => {
  const roster = loaded(agent('t1', 'working'));
  const delta = onlyDelta(roster.fold(eventOf(13, 't1', 'status', { status: null })));
  assert.equal(delta.kind, 'removed');
  assert.equal(roster.get(addr('t1')), null);
});

test('finished and lost remove the terminal from the table and from addresses()', () => {
  for (const type of ['finished', 'lost']) {
    const roster = loaded(agent('t1', 'working'));
    const delta = onlyDelta(roster.fold(eventOf(14, 't1', type, { exit_code: 0, finished_ms: 5, reason: 'exit', signal: null })));
    assert.equal(delta.kind, 'removed', type);
    assert.deepEqual(roster.addresses(), [], type);
    assert.equal(roster.terminals.size, 0, type);
  }
});

test('restarted replaces the row, and removed deletes it', () => {
  const roster = loaded(agent('t1', 'working'));
  const restarted = onlyDelta(roster.fold(eventOf(15, 't1', 'restarted', agent('t1', 'idle'))));
  assert.equal(restarted.kind, 'changed');
  const removed = onlyDelta(roster.fold(eventOf(16, 't1', 'removed', agent('t1', 'idle'))));
  assert.equal(removed.kind, 'removed');
  assert.deepEqual(roster.addresses(), []);
});

test('a labels patch that moves the tab is a changed delta', () => {
  const roster = loaded(agent('t1', 'working'));
  const delta = onlyDelta(roster.fold(eventOf(17, 't1', 'labels', { labels: { 'herdr.tab': 'tb2', 'herdr.space': 'sp1' } })));
  assert.equal(delta.kind, 'changed');
  assert.equal(delta.terminal.tab, 'tb2');
});

test('a foreground patch changes the working directory and the process', () => {
  const roster = loaded(agent('t1', 'working'));
  const delta = onlyDelta(roster.fold(eventOf(18, 't1', 'foreground', { pid: 99, cwd: '/tmp/moved' })));
  assert.equal(delta.kind, 'changed');
  assert.equal(delta.terminal.cwd, '/tmp/moved');
  assert.equal(delta.terminal.pid, 99);
});

test('turn and doc change no row and report no unknown type; a future kind reports itself as unknownType', () => {
  const roster = loaded(agent('t1', 'working'));
  for (const type of ['turn', 'doc']) {
    const step = roster.fold(eventOf(19, 't1', type, { anything: true }));
    assert.deepEqual(step.deltas, [], type);
    assert.equal(step.unknownType, null, type);
  }
  const before = roster.revision;
  const future = roster.fold(eventOf(20, 't1', 'future-kind', {}));
  assert.deepEqual(future.deltas, []);
  assert.equal(future.unknownType, 'future-kind');
  assert.equal(future.revision, before + 1);
});

test('an event for an address the table never held is ignored, while the revision still moves', () => {
  const roster = loaded(agent('t1', 'working'));
  const step = roster.fold(eventOf(21, 'zz', 'status', { status: { app: 'claude-code', state: 'idle' } }));
  assert.deepEqual(step.deltas, []);
  assert.equal(step.revision, 1);
  assert.equal(roster.get(addr('zz')), null);
});

test('an event with no terminal uses the address in its data', () => {
  const roster = loaded(agent('t1', 'working'));
  const delta = onlyDelta(roster.fold(eventOf(22, null, 'status', { address: 't1', status: { app: 'claude-code', state: 'blocked' } })));
  assert.equal(delta.kind, 'changed');
  assert.equal(delta.terminal.status, 'blocked');
});

test('a missed feed replaces the table: removed first, then changed, then added', () => {
  const roster = loaded(agent('t1', 'working'), agent('t2', 'idle'));
  const step = roster.fold({ kind: HcKind.Missed, snapshot: missedOf(30, [agent('t1', 'idle'), agent('t3', 'working')]).snapshot });
  assert.deepEqual(pairsOf(step.deltas), [['removed', 't2'], ['changed', 't1'], ['added', 't3']]);
  assert.equal(step.seq, 30);
  assert.equal(step.revision, 1);
  assert.equal(step.initial, false);
});

test('a malformed row in a snapshot is skipped and does not stop the others', () => {
  const roster = new CoreRoster();
  const step = roster.fold({ kind: HcKind.Snapshot, snapshot: snapshotOf(40, [{ labels: { 'herdr.tab': 'tb1', 'herdr.space': 'sp1' } }, agent('t1', 'working')]) });
  assert.deepEqual(kindsOf(step.deltas), ['added']);
  assert.deepEqual(roster.addresses(), ['t1']);
});

test('heartbeat moves neither the revision nor the seq and reports no deltas', () => {
  const roster = loaded(agent('t1', 'working'));
  roster.fold(eventOf(50, 't1', 'turn', {}));
  const before = roster.revision;
  const seq = roster.seq;
  const beat = roster.fold(heartbeatOf(77));
  assert.equal(beat.revision, before);
  assert.equal(beat.seq, seq);
  assert.deepEqual(beat.deltas, []);
  assert.equal(beat.initial, false);
});

test('seq follows the last event or snapshot and not the heartbeat', () => {
  const roster = new CoreRoster();
  roster.fold({ kind: HcKind.Snapshot, snapshot: snapshotOf(100, [agent('t1', 'working')]) });
  assert.equal(roster.seq, 100);
  roster.fold(eventOf(101, 't1', 'status', { status: { app: 'claude-code', state: 'idle' } }));
  assert.equal(roster.seq, 101);
  roster.fold(heartbeatOf(500));
  assert.equal(roster.seq, 101);
});

test('loadIfCurrent applies only while the revision is unchanged', () => {
  const roster = loaded(agent('t1', 'working'));
  const since = roster.revision;
  roster.fold(eventOf(60, 't1', 'turn', {}));
  assert.equal(roster.loadIfCurrent(since, [row(agent('t1', 'idle'))]), null);
  assert.equal(roster.get(addr('t1'))?.status, 'working');
  const applied = roster.loadIfCurrent(roster.revision, [row(agent('t1', 'idle'))]);
  assert.ok(applied !== null);
  assert.deepEqual(kindsOf(applied), ['changed']);
  assert.equal(roster.get(addr('t1'))?.status, 'idle');
});

test('load does not bump the revision', () => {
  const roster = loaded(agent('t1', 'working'));
  const before = roster.revision;
  roster.load([row(agent('t1', 'idle')), row(agent('t9', 'working'))]);
  assert.equal(roster.revision, before);
});

interface Rig {
  readonly core: FakeHcCore;
  readonly iterator: AsyncIterator<HcCoreFeed>;
  readonly roster: CoreRoster;
}

async function withRoster(run: (rig: Rig) => Promise<void>, timing: CoreEventsTiming = FAST): Promise<void> {
  const core = await FakeHcCore.start();
  const events = new CoreEvents({ path: core.path, timing });
  const iterator = events.feed[Symbol.asyncIterator]();
  try {
    events.start();
    await run({ core, iterator, roster: new CoreRoster() });
  } finally {
    await events.close();
    await core.stop();
  }
}

async function nextFeed(iterator: AsyncIterator<HcCoreFeed>): Promise<HcCoreFeed> {
  const got = await nextWithin(iterator, WAIT);
  assert.ok(got !== null, 'waited for a feed');
  return got;
}

test('through CoreEvents: a status event is a changed delta, and a missed feed is the diff against it', async () => {
  await withRoster(async ({ core, iterator, roster }) => {
    const first = roster.fold(await nextFeed(iterator));
    assert.equal(first.initial, true);
    await later(20);
    core.event('status', 't1', { status: { app: 'claude-code', state: 'idle' } });
    const changed = onlyDelta(roster.fold(await nextFeed(iterator)));
    assert.equal(changed.kind, 'changed');
    core.missed([agentTerminal('t1', 'working')]);
    const diff = roster.fold(await nextFeed(iterator));
    assert.deepEqual(pairsOf(diff.deltas), [['removed', 't2'], ['changed', 't1']]);
    const moved = diff.deltas[1];
    assert.ok(moved?.kind === 'changed');
    assert.equal(moved.before.status, 'idle');
    assert.equal(moved.terminal.status, 'working');
  });
});

test('through CoreEvents: after a dropped connection the new snapshot folds as the diff against what was held', async () => {
  await withRoster(async ({ core, iterator, roster }) => {
    roster.fold(await nextFeed(iterator));
    core.terminals = [agentTerminal('t1', 'working'), agentTerminal('t5', 'blocked')];
    core.dropAll();
    const again = await nextFeed(iterator);
    assert.equal(again.kind, HcKind.Snapshot);
    assert.deepEqual(pairsOf(roster.fold(again).deltas), [['removed', 't2'], ['added', 't5']]);
    assert.equal(core.connections, 2);
  });
});

test('through CoreEvents: a silent core is dropped by the watchdog, and the reconnect snapshot folds', async () => {
  await withRoster(async ({ core, iterator, roster }) => {
    roster.fold(await nextFeed(iterator));
    core.silent = true;
    core.terminals = [agentTerminal('t6', 'idle')];
    await later(450);
    assert.ok(core.connections >= 2);
    core.silent = false;
    const again = await nextFeed(iterator);
    assert.equal(again.kind, HcKind.Snapshot);
    assert.deepEqual(pairsOf(roster.fold(again).deltas), [['removed', 't1'], ['removed', 't2'], ['added', 't6']]);
  });
});
