// Role: checks CoreTerminals: terminal.list, terminal.get and terminal.read over a CoreLink to the fake core, the terminal.read line semantics and lastLines.
// Informs HERDR-ADR-0020 (the herdr-core client); the tests run against the fake core only, never a real herdr.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UnknownWhy } from '../../src/core/constants.ts';
import { isUnknown } from '../../src/core/errors.ts';
import type { Unknown } from '../../src/core/errors.ts';
import { duration, must, parseCount, parseText } from '../../src/core/kernel.ts';
import { CoreRoster } from '../../src/core/roster.ts';
import { agentTerminal, FakeFault, later } from '../../src/core/test-kit/fake-core.ts';
import { openWorld } from '../../src/core/test-kit/setup-test.ts';
import { CoreTerminals, lastLines } from '../../src/core/terminals.ts';
import { hcAddressOf, parseHcAddress } from '../../src/core/terminal.ts';

const addr = (text: string) => must(parseHcAddress(text));
const count = (value: number) => must(parseCount(value));

function answered<T extends { readonly kind: string }>(value: T | Unknown): T {
  assert.ok(!isUnknown(value), `expected an answer, got ${JSON.stringify(value)}`);
  return value;
}

function whyOf(value: { readonly kind: string } | Unknown): string {
  assert.ok(isUnknown(value), `expected an Unknown, got ${JSON.stringify(value)}`);
  return value.why.why;
}

test('list returns the demo terminals as rows with the hidden-finished count, and the rows load straight into CoreRoster', async () => {
  const world = await openWorld();
  try {
    const listing = answered(await new CoreTerminals(world.link()).list());
    assert.deepEqual(listing.terminals.map(hcAddressOf), ['t1', 't2']);
    assert.equal(listing.hiddenFinished, 0);
    const deltas = new CoreRoster().load(listing.terminals);
    assert.deepEqual(deltas.map((delta) => delta.terminal.address), ['t1', 't2']);
  } finally {
    await world.close();
  }
});

test('list drops the rows that are not objects and reads hidden_finished from the reply', async () => {
  const world = await openWorld();
  try {
    world.core.on('terminal.list', () => ({ terminals: [agentTerminal('t3', 'idle'), 5], hidden_finished: 2 }));
    const listing = answered(await new CoreTerminals(world.link()).list());
    assert.deepEqual(listing.terminals.map(hcAddressOf), ['t3']);
    assert.equal(listing.hiddenFinished, 2);
  } finally {
    await world.close();
  }
});

test('a list reply with no terminals array is unreadable', async () => {
  const world = await openWorld();
  try {
    world.core.on('terminal.list', () => ({}));
    const outcome = await new CoreTerminals(world.link()).list();
    assert.equal(whyOf(outcome), UnknownWhy.Unreadable);
  } finally {
    await world.close();
  }
});

test('get returns the row of a known address, and an unknown address is not-found', async () => {
  const world = await openWorld();
  try {
    const terminals = new CoreTerminals(world.link());
    const fetched = answered(await terminals.get(addr('t1')));
    assert.equal(hcAddressOf(fetched.terminal), 't1');
    assert.equal(whyOf(await terminals.get(addr('nope'))), UnknownWhy.NotFound);
  } finally {
    await world.close();
  }
});

test('a get fault other than not_found stays failed, with its code', async () => {
  const world = await openWorld();
  try {
    world.core.on('terminal.get', () => { throw new FakeFault(-32603, 'internal', 'boom'); });
    const outcome = await new CoreTerminals(world.link()).get(addr('t1'));
    assert.ok(isUnknown(outcome));
    assert.equal(outcome.why.why, UnknownWhy.Failed);
    assert.equal(outcome.why.why === UnknownWhy.Failed ? outcome.why.code : 0, -32603);
  } finally {
    await world.close();
  }
});

test('read sends lines 0 by default: the visible screen only; history sends the count above it', async () => {
  const world = await openWorld();
  try {
    const terminals = new CoreTerminals(world.link());
    answered(await terminals.read(addr('t1')));
    assert.deepEqual(world.core.seen.at(-1)?.params, { terminal: 't1', lines: 0 });
    answered(await terminals.read(addr('t1'), { history: count(5) }));
    assert.deepEqual(world.core.seen.at(-1)?.params, { terminal: 't1', lines: 5 });
  } finally {
    await world.close();
  }
});

test('read returns the text, complete, how and why of the reply; an unknown how and a why pass through', async () => {
  const world = await openWorld();
  try {
    const terminals = new CoreTerminals(world.link());
    const plain = answered(await terminals.read(addr('t1')));
    assert.equal(plain.text, 'screen of t1');
    assert.equal(plain.complete, true);
    assert.equal(plain.how, 'screen');
    assert.equal(plain.why, null);
    world.core.on('terminal.read', () => ({ text: 'a\nb', complete: false, how: 'weird', why: 'working' }));
    const odd = answered(await terminals.read(addr('t1')));
    assert.equal(odd.text, 'a\nb');
    assert.equal(odd.complete, false);
    assert.equal(odd.how, 'weird');
    assert.equal(odd.why, 'working');
  } finally {
    await world.close();
  }
});

test('a read reply with no text, or a complete that is not a boolean, is unreadable', async () => {
  const world = await openWorld();
  try {
    const terminals = new CoreTerminals(world.link());
    world.core.on('terminal.read', () => ({ complete: true, how: 'screen', why: null }));
    assert.equal(whyOf(await terminals.read(addr('t1'))), UnknownWhy.Unreadable);
    world.core.on('terminal.read', () => ({ text: 'x', complete: 'yes', how: 'screen', why: null }));
    assert.equal(whyOf(await terminals.read(addr('t1'))), UnknownWhy.Unreadable);
  } finally {
    await world.close();
  }
});

test('read of an unknown address is not-found when the core answers not_found', async () => {
  const world = await openWorld();
  try {
    world.core.on('terminal.read', () => { throw new FakeFault(-32000, 'not_found', 'no terminal'); });
    assert.equal(whyOf(await new CoreTerminals(world.link()).read(addr('nope'))), UnknownWhy.NotFound);
  } finally {
    await world.close();
  }
});

test('a core that speaks another generation makes every typed read unreadable', async () => {
  const world = await openWorld();
  try {
    world.core.hello({ generation: 2 });
    const terminals = new CoreTerminals(world.link());
    assert.equal(whyOf(await terminals.list()), UnknownWhy.Unreadable);
    assert.ok(isUnknown(await terminals.get(addr('t1'))));
    assert.ok(isUnknown(await terminals.read(addr('t1'))));
  } finally {
    await world.close();
  }
});

test('a read slower than the call timeout is a timeout', async () => {
  const world = await openWorld();
  try {
    world.core.delay('terminal.read', 200);
    const outcome = await new CoreTerminals(world.link(), duration(50)).read(addr('t1'));
    assert.equal(whyOf(outcome), UnknownWhy.Timeout);
  } finally {
    await world.close();
  }
});

test('after a drop the typed reads are unreachable, then the link reconnects and the reads work again', async () => {
  const world = await openWorld();
  try {
    const link = world.link();
    const terminals = new CoreTerminals(link);
    await link.open();
    world.core.dropAll();
    await later(10);
    assert.equal(whyOf(await terminals.read(addr('t1'))), 'unreachable');
    await later(120);
    assert.equal(answered(await terminals.read(addr('t1'))).how, 'screen');
  } finally {
    await world.close();
  }
});

test('lastLines keeps the last count lines and says whether a line was dropped', () => {
  const check = (value: string, n: number) => lastLines(must(parseText(value)), count(n));
  assert.deepEqual(check('a\nb\nc', 5), { text: 'a\nb\nc', truncated: false });
  assert.deepEqual(check('a\nb\nc', 3), { text: 'a\nb\nc', truncated: false });
  assert.deepEqual(check('a\nb\nc', 2), { text: 'b\nc', truncated: true });
  assert.deepEqual(check('a\nb\nc', 0), { text: '', truncated: true });
  assert.deepEqual(check('', 0), { text: '', truncated: true });
  assert.deepEqual(check('', 1), { text: '', truncated: false });
  assert.deepEqual(check('a\nb\n', 2), { text: 'b\n', truncated: true });
  assert.deepEqual(check('a\nb\n', 3), { text: 'a\nb\n', truncated: false });
});
