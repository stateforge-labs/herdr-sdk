// Role: checks toolNameOf: herdr_ prefix, dots become underscores, every read-only tool name is unique and well formed.
// Informs HERDR-ADR-0010 and plan 7 (lane P6c). Pure: no socket, no fake.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { LONG_POLL, Method } from '../../src/generated/index.ts';
import { ENTRY_METHODS } from '../../src/generated/entry-methods.ts';
import { toolNameOf } from '../../src/mcp/tool-name.ts';
import type { ReadOnlyToolMethod } from '../../src/mcp/types.ts';

const TOOL_NAME_PATTERN = /^herdr_[a-z0-9_]+$/;

// The read-only methods a toolkit may wrap: the generated readOnly entry minus long-poll and subscribe (types.ts).
const readOnlyToolMethods = (): ReadOnlyToolMethod[] =>
  ENTRY_METHODS.readOnly.filter(
    (method) => !Object.hasOwn(LONG_POLL, method) && method !== Method.EventsSubscribe,
  ) as ReadOnlyToolMethod[];

describe('toolNameOf', () => {
  test('prefixes herdr_ and turns the dot of a method into an underscore', () => {
    assert.equal(toolNameOf('pane.list' as ReadOnlyToolMethod), 'herdr_pane_list');
  });

  test('replaces every dot of a multi-dot method', () => {
    assert.equal(toolNameOf('pane.link.resolve' as ReadOnlyToolMethod), 'herdr_pane_link_resolve');
  });

  test('gives every read-only tool method a unique name that matches the tool name pattern', () => {
    const names = readOnlyToolMethods().map((method) => toolNameOf(method));
    assert.ok(names.length > 0);
    assert.equal(new Set(names).size, names.length);
    for (const name of names) assert.match(name, TOOL_NAME_PATTERN);
  });
});
