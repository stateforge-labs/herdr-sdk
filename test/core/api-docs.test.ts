// Role: checks the herdr-core client: the hand-written API reference names every export it promises, and each name is a real export of ./core.
// Informs HERDR-ADR-0014 (executable docs) and the rule that every public symbol has docs in docs/api and a row in the skill.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as core from '../../src/core.ts';

const DOCUMENTED = ['HcTerminal', 'parseHcTerminal', 'HcAddress', 'parseHcAddress', 'hcAddressOf', 'hcTerminalEqual', 'parseHcPlacement', 'parseHcReport', 'parseHcForeground', 'parsePositiveCount', 'HcLabel', 'HcTerminalField', 'HcTerminalState', 'CoreRoster', 'RosterDelta', 'RosterStep', 'HcEventType', 'HcPatchField', 'RosterChange', 'isHcEventType', 'CoreTerminals', 'HcListing', 'HcFetched', 'HcScreen', 'HcReadOptions', 'parseHcListing', 'parseHcScreen', 'lastLines', 'HcReadField', 'HcReadHow', 'HcReadWhy', 'HC_RPC_NOT_FOUND', 'Brand', 'Fields', 'brand', 'ok', 'err', 'isFields'];
const SKILL_ROWS = ['HcTerminal', 'parseHcTerminal', 'CoreRoster', 'CoreTerminals'];
const CORE_DOC = new URL('../../docs/api/core.md', import.meta.url);
const SKILL = new URL('../../skills/herdr-sdk/SKILL.md', import.meta.url);

const VALUES = ['parseHcTerminal', 'parseHcAddress', 'hcAddressOf', 'hcTerminalEqual', 'parseHcPlacement', 'parseHcReport', 'parseHcForeground', 'parsePositiveCount', 'HcLabel', 'HcTerminalField', 'HcTerminalState', 'CoreRoster', 'isHcEventType', 'HcEventType', 'RosterChange', 'HcPatchField', 'CoreTerminals', 'parseHcListing', 'parseHcScreen', 'lastLines', 'HcReadField', 'HcReadHow', 'HcReadWhy', 'HC_RPC_NOT_FOUND', 'brand', 'ok', 'err', 'isFields'];

test('every documented value is an export of ./core (types are erased, the docs test names them)', () => {
  const exported = new Set(Object.keys(core));
  for (const name of VALUES) {
    assert.ok(exported.has(name), `${name} is not exported from ./core`);
  }
});

test('the hand-written reference names every documented export', () => {
  const text = readFileSync(CORE_DOC, 'utf8');
  for (const name of DOCUMENTED) {
    assert.ok(text.includes(name), `docs/api/core.md does not name ${name}`);
  }
});

test('the skill row for ./core names the terminal types', () => {
  const text = readFileSync(SKILL, 'utf8');
  for (const name of SKILL_ROWS) {
    assert.ok(text.includes(name), `SKILL.md does not name ${name}`);
  }
});
