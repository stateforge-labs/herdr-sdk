// Role: checks parseArgs(): the defaults, each flag, and the usage errors (unknown flag, flag without value).
// Informs HERDR-ADR-0009 (exit 2 is misuse); new test for lane P5c.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../../src/drift/cli.ts';
import { ArgsKind } from '../../src/drift/constants.ts';

describe('parseArgs', () => {
  test('no flags is a run with the defaults left to the bin', () => {
    assert.deepEqual(parseArgs([]), { kind: ArgsKind.Run, committed: null, herdr: null, json: false });
  });

  test('reads --committed, --herdr and --json', () => {
    assert.deepEqual(parseArgs(['--committed', '/x', '--herdr', '/bin/herdr', '--json']), {
      kind: ArgsKind.Run,
      committed: '/x',
      herdr: '/bin/herdr',
      json: true,
    });
  });

  test('--help is a help request', () => {
    assert.deepEqual(parseArgs(['--help']), { kind: ArgsKind.Help });
  });

  test('an unknown flag is a usage error', () => {
    assert.deepEqual(parseArgs(['--nope']), { kind: ArgsKind.Usage, message: "unexpected argument '--nope'" });
  });

  test('a flag that needs a value without one is a usage error', () => {
    assert.deepEqual(parseArgs(['--herdr']), { kind: ArgsKind.Usage, message: '--herdr needs a value' });
  });
});
