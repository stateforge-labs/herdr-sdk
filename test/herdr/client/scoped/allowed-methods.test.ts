// Role: the allow-list of each entry, preset and method list: equal to the generated tables, and `methods` only narrows.
// Informs HERDR-ADR-0005 (runtime allow-list) and plan 3.4; slice P2b-1 (P4b's held tests depend on it).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EntryKey, Presets } from '../../../../src/constants.ts';
import { ENTRY_METHODS, Method, PRESET_METHODS } from '../../../../src/herdr/generated/index.ts';
import { allowedMethods } from '../../../../src/herdr/client/scoped/allowed-methods.ts';

const sorted = (values: Iterable<string>): string[] => [...values].sort();

describe('allowedMethods', () => {
  for (const entry of Object.values(EntryKey)) {
    test(`the ${entry} entry equals ENTRY_METHODS[${entry}]`, () => {
      assert.deepEqual(sorted(allowedMethods(ENTRY_METHODS[entry])), sorted(ENTRY_METHODS[entry]));
    });
  }

  test('the SessionsReader preset equals PRESET_METHODS.SessionsReader', () => {
    const preset = allowedMethods(PRESET_METHODS[Presets.SessionsReader]);
    assert.deepEqual(sorted(preset), sorted(PRESET_METHODS[Presets.SessionsReader]));
  });

  test('methods narrows the entry to the listed methods that the entry has', () => {
    const narrowed = allowedMethods(ENTRY_METHODS[EntryKey.readOnly], { methods: [Method.AgentList, Method.AgentPrompt] });
    assert.deepEqual(sorted(narrowed), [Method.AgentList]);
  });

  test('methods cannot widen the entry: a method outside it is dropped', () => {
    const narrowed = allowedMethods(ENTRY_METHODS[EntryKey.readOnly], { methods: [Method.ServerStop] });
    assert.equal(narrowed.size, 0);
  });

  test('long-poll methods are kept only when listed', () => {
    assert.equal(allowedMethods(ENTRY_METHODS[EntryKey.readOnly], { methods: [Method.AgentList] }).has(Method.AgentWait), false);
    assert.equal(allowedMethods(ENTRY_METHODS[EntryKey.readOnly], { methods: [Method.AgentWait] }).has(Method.AgentWait), true);
  });

  test('held is the four class C methods', () => {
    assert.deepEqual(sorted(allowedMethods(ENTRY_METHODS[EntryKey.held])), [
      'client.window_title.clear',
      'client.window_title.set',
      'client_shell.surface.set',
      'server.ssh_agent.register',
    ]);
  });
});
