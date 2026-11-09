// Role: checks the herdr-core client: terminal.
// Informs HERDR-ADR-0020 (the herdr-core client); ported from tab-recap's hc-terminal test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ParseFailureKind } from '../../src/core/constants.ts';
import { must } from '../../src/core/kernel.ts';
import { agentTerminal, shellTerminal } from '../../src/core/test-kit/fake-core.ts';
import { hcAddressOf, hcTerminalEqual, parseHcAddress, parseHcForeground, parseHcPlacement, parseHcReport, parseHcTerminal } from '../../src/core/terminal.ts';
import type { HcTerminal } from '../../src/core/terminal.ts';
import { parseHcPayload } from '../../src/core/wire.ts';

const agent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({ ...agentTerminal('t1', 'working'), ...overrides });

function terminalOf(row: unknown): HcTerminal {
  const parsed = parseHcTerminal(row);
  assert.ok(parsed.kind === 'ok', `expected a terminal, got ${JSON.stringify(parsed)}`);
  return parsed.value;
}

function failureOf(row: unknown): string {
  const parsed = parseHcTerminal(row);
  assert.ok(parsed.kind === 'err');
  return parsed.error.kind;
}

test('a terminal that reports an agent under a labelled tab is a terminal; a shell, a finished one and an unlabelled one are not', () => {
  assert.equal(parseHcTerminal(agent()).kind, 'ok');
  assert.equal(parseHcTerminal(shellTerminal('t2')).kind, 'err');
  assert.equal(parseHcTerminal(agent({ state: 'finished' })).kind, 'err');
  assert.equal(parseHcTerminal(agent({ labels: {} })).kind, 'err');
});

test('the cwd is the foreground one, else the terminal one; the pid comes from the foreground', () => {
  const parsed = terminalOf(agent());
  assert.equal(parsed.cwd, '~/work/probe');
  assert.equal(parsed.pid, 4242);
  const bare = terminalOf(agent({ foreground: null, cwd: '/work' }));
  assert.equal(bare.cwd, '/work');
  assert.equal(bare.pid, null);
});

test('the parsed row carries the address, the placement, the report and the title', () => {
  const parsed = terminalOf(agent({ title: 'a title' }));
  assert.equal(parsed.address, 't1');
  assert.equal(parsed.tab, 'tb1');
  assert.equal(parsed.workspace, 'sp1');
  assert.equal(parsed.app, 'claude-code');
  assert.equal(parsed.status, 'working');
  assert.equal(parsed.title, 'a title');
});

test('a non-object row is not a row; an array is an object with no fields, so it is empty', () => {
  assert.equal(failureOf(null), ParseFailureKind.NotARow);
  assert.equal(failureOf('t1'), ParseFailureKind.NotARow);
  assert.equal(failureOf([]), ParseFailureKind.Empty);
});

test('an empty address, an empty label or a missing app is not a terminal', () => {
  assert.equal(failureOf(agent({ address: '' })), ParseFailureKind.Empty);
  assert.equal(failureOf(agent({ labels: { 'herdr.tab': '', 'herdr.space': 'sp1' } })), ParseFailureKind.Empty);
  assert.equal(failureOf(agent({ labels: { 'herdr.tab': 'tb1', 'herdr.space': '' } })), ParseFailureKind.Empty);
  assert.equal(failureOf(agent({ status: { state: 'working' } })), ParseFailureKind.Empty);
});

test('a state other than live is not a terminal, whatever its value', () => {
  assert.equal(failureOf(agent({ state: 'zombie' })), ParseFailureKind.Empty);
});

test('a pid that is not a positive integer is null, never an error', () => {
  for (const pid of [0, -1, 1.5, '7']) {
    assert.equal(terminalOf(agent({ foreground: { pid, cwd: '/w' } })).pid, null);
  }
});

test('a foreground that is not an object falls back to the terminal cwd', () => {
  const parsed = terminalOf(agent({ foreground: 'bash', cwd: '/home' }));
  assert.equal(parsed.pid, null);
  assert.equal(parsed.cwd, '/home');
});

test('extra unknown fields are ignored and a title that is not text is null', () => {
  const parsed = terminalOf(agent({ title: 7, mystery: { anything: true } }));
  assert.equal(parsed.title, null);
  assert.equal(terminalOf(agent({ title: '' })).title, '');
});

test('the field parsers stand alone with the same rules', () => {
  assert.equal(parseHcAddress('').kind, 'err');
  assert.equal(parseHcAddress('t9').kind, 'ok');
  assert.equal(parseHcPlacement({ 'herdr.tab': 'tb1' }).kind, 'err');
  assert.equal(parseHcReport({ app: 'claude-code', state: 'idle' }).kind, 'ok');
  assert.equal(parseHcReport(null).kind, 'err');
  assert.equal(parseHcForeground(null).kind, 'err');
  assert.deepEqual(must(parseHcForeground({ foreground: { pid: 9 } })), { pid: 9, cwd: null });
});

test('hcAddressOf reads the address of a payload, null when there is none', () => {
  assert.equal(hcAddressOf(must(parseHcPayload(agent()))), 't1');
  assert.equal(hcAddressOf(must(parseHcPayload({ cwd: '/w' }))), null);
});

test('hcTerminalEqual is true for the same row and false when only the status differs', () => {
  const a = terminalOf(agent());
  assert.equal(hcTerminalEqual(a, terminalOf(agent())), true);
  assert.equal(hcTerminalEqual(a, terminalOf(agent({ state: 'live', status: { app: 'claude-code', state: 'idle' } }))), false);
});
