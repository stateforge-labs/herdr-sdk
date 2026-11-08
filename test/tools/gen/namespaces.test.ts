// Role: tests of the namespace types (tools/gen/emit-namespaces.ts) over the emitted text of src/herdr/generated/namespaces.ts.
// Informs HERDR-ADR-0005 (flat per-class output) and plan sections 3.2, 3.4 and 3.6 (held connections, long-poll timeouts).
import { describe, expect, test } from 'bun:test';
import { emitNamespaces } from '../../../tools/gen/emit-namespaces.ts';
import { GEN_PATHS, loadSchema } from '../../../tools/gen/schema.ts';

const schema = loadSchema(GEN_PATHS.schemaPath);
const emitted = emitNamespaces(schema, '');

const MEMBER_PREFIX = /^([A-Za-z_$"][^(]*)\(params/;
const BRANCH_PREFIX = /^([A-Za-z_$"][^:(]*): \{$/;
const QUOTE = '"';

function unquote(key: string): string {
  return key.split(QUOTE).join('');
}

// The dotted method paths of one emitted interface, with the signature line of each.
function membersOf(text: string, name: string): ReadonlyMap<string, string> {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line === `export interface ${name} {`);
  const stack: string[] = [];
  const members = new Map<string, string>();
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (line === '}') {
      break;
    }
    if (trimmed === '};') {
      stack.pop();
      continue;
    }
    const branch = BRANCH_PREFIX.exec(trimmed);
    if (branch?.[1] !== undefined) {
      stack.push(unquote(branch[1]));
      continue;
    }
    const member = MEMBER_PREFIX.exec(trimmed);
    if (member?.[1] !== undefined) {
      members.set([...stack, unquote(member[1])].join('.'), line);
    }
  }
  return members;
}

describe('entry interfaces', () => {
  const readOnly = membersOf(emitted, 'ReadOnlyNamespaces');
  const readOnlyContent = membersOf(emitted, 'ReadOnlyContentNamespaces');
  const admin = membersOf(emitted, 'AdminNamespaces');
  const held = membersOf(emitted, 'HeldNamespaces');

  test('ReadOnlyNamespaces has no content, write or stop methods', () => {
    for (const method of ['pane.read', 'pane.close', 'server.stop', 'client.window_title.set']) {
      expect(readOnly.has(method)).toBe(false);
    }
  });

  test('ReadOnlyContentNamespaces adds the content reads', () => {
    expect(readOnlyContent.has('pane.read')).toBe(true);
    expect(readOnlyContent.has('agent.read')).toBe(true);
  });

  test('AdminNamespaces has server.stop and no connection-scoped method', () => {
    expect(admin.has('server.stop')).toBe(true);
    for (const method of ['client.window_title.set', 'client_shell.surface.set', 'server.ssh_agent.register']) {
      expect(admin.has(method)).toBe(false);
    }
  });

  test('HeldNamespaces has exactly the four connection-scoped methods', () => {
    expect([...held.keys()].sort()).toEqual([
      'client.window_title.clear', 'client.window_title.set', 'client_shell.surface.set', 'server.ssh_agent.register',
    ]);
  });
});

describe('member signatures', () => {
  const readOnly = membersOf(emitted, 'ReadOnlyNamespaces');
  const readOnlyContent = membersOf(emitted, 'ReadOnlyContentNamespaces');

  test('a long-poll method takes a required timeout_ms in its params', () => {
    expect(readOnly.get('agent.wait')).toContain('timeout_ms: number');
    expect(readOnly.get('agent.wait')).toContain('params: Omit<P.AgentWaitParams, "timeout_ms">');
  });

  test('params are optional when the schema has no required key', () => {
    expect(readOnly.get('ping')).toContain('params?: P.PingParams');
  });

  test('params are required when the schema has required keys', () => {
    expect(readOnlyContent.get('agent.read')).toContain('params: P.AgentReadParams');
  });

  test('every mapped result is its tag', () => {
    expect(readOnly.get('agent.explain')).toContain('Promise<ResultByTag["agent_explain"]>');
    expect(readOnly.get('agent.get')).toContain('Promise<ResultByTag["agent_info"]>');
  });
});
