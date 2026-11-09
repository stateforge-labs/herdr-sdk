// Role: checks the hand-written client reference: the names it promises for connectPlugin are real exports of the main entry, and the skill row names them.
// Informs HERDR-ADR-0014 (executable docs) and the rule that every public symbol has docs in docs/api and a row in the skill.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as main from '../../src/index.ts';

const DOCUMENTED = ['connectPlugin', 'PluginClient', 'ConnectPlugin', 'plugin.pane.open', 'plugin.pane.focus', 'plugin.pane.close', 'plugin_pane_opened', 'plugin_pane_focused', 'plugin_pane_closed', 'HerdrTransportError', 'ErrorCode', 'UnsupportedWatchError', 'SubscriptionEventKind', 'Watch.update', 'WatchOptions.idleMs'];
const CLIENT_DOC = new URL('../../docs/api/client.md', import.meta.url);
const SKILL = new URL('../../skills/herdr-sdk/SKILL.md', import.meta.url);

test('connectPlugin is an export of the main entry', () => {
  assert.equal(typeof (main as Record<string, unknown>).connectPlugin, 'function');
});

test('the client reference names every documented symbol', () => {
  const text = readFileSync(CLIENT_DOC, 'utf8');
  for (const name of DOCUMENTED) {
    assert.ok(text.includes(name), `docs/api/client.md does not name ${name}`);
  }
});

test('the skill names connectPlugin and the client reference', () => {
  const text = readFileSync(SKILL, 'utf8');
  assert.ok(text.includes('connectPlugin()'), 'SKILL.md does not name connectPlugin()');
  assert.ok(text.includes('docs/api/client.md'), 'SKILL.md does not point to docs/api/client.md');
});
