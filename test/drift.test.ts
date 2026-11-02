// Role: acceptance test of the herdr-drift CLI: no herdr on PATH is exit 3, a bad flag is exit 2, a matching fake herdr is clean (exit 0), the real committed schema reports its known METHOD_RESULT gap (exit 1), and a fake that serves a moved protocol drifts (exit 1).
// Informs HERDR-ADR-0009 (exit codes; "could not look" is 3) and HERDR-ADR-0008 (the test never runs the real herdr: PATH holds only a fake or nothing); plan row 5c.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { DriftExitCode } from '../src/constants.ts';
import { ReasonText } from '../src/drift/constants.ts';
import { committedDirectory, committedSchemaText, committedVersionText } from './drift/support/real-schema.ts';
import { miniSchema } from './drift/support/mini-schema.ts';

const BIN = fileURLToPath(new URL('../bin/herdr-drift.ts', import.meta.url));
// The committed schema lists 102 methods and METHOD_RESULT maps 25 of them (77 unmapped). P3 regenerates the table and this pin changes with it.
const KNOWN_UNMAPPED_METHODS = 77;
const UNMAPPED_LINE = 'methods without a METHOD_RESULT row: ';
const FAKE_SCRIPT = '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "herdr 0.9.5"; exit 0; fi\n/bin/cat "$FAKE_SCHEMA_FILE"\n';

interface Run {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runDrift(args: readonly string[], env: Record<string, string>): Run {
  const result = spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8', env });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

// A temp directory with a fake `herdr` on its own PATH. It serves the schema file named by FAKE_SCHEMA_FILE.
function fakeHerdrDirectory(schemaFile: string): { readonly dir: string; readonly env: Record<string, string> } {
  const dir = mkdtempSync(join(tmpdir(), 'herdr-drift-fake-'));
  const script = join(dir, 'herdr');
  writeFileSync(script, FAKE_SCRIPT);
  chmodSync(script, 0o755);
  return { dir, env: { PATH: dir, FAKE_SCHEMA_FILE: schemaFile } };
}

describe('herdr-drift CLI', () => {
  test('no herdr on PATH is exit 3 and the reason is named', () => {
    const empty = mkdtempSync(join(tmpdir(), 'herdr-drift-empty-'));
    try {
      const run = runDrift([], { PATH: empty });
      assert.equal(run.status, DriftExitCode.NotCovered);
      assert.ok(run.stderr.includes(ReasonText.HerdrMissing), run.stderr);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  test('a bad flag is exit 2', () => {
    const run = runDrift(['--nope'], { PATH: '' });
    assert.equal(run.status, DriftExitCode.Usage);
    assert.ok(run.stderr.includes("unexpected argument '--nope'"), run.stderr);
  });

  test('--help is exit 0 and lists the exit codes', () => {
    const run = runDrift(['--help'], { PATH: '' });
    assert.equal(run.status, DriftExitCode.Clean);
    assert.ok(run.stdout.includes('Exits:'), run.stdout);
  });

  // Clean path: a committed copy whose methods all have METHOD_RESULT rows, and a fake herdr that serves the same schema. Exit 0.
  test('a committed copy that matches the fake herdr is clean (exit 0)', () => {
    const committed = mkdtempSync(join(tmpdir(), 'herdr-drift-mini-'));
    writeFileSync(join(committed, 'herdr-api.schema.json'), JSON.stringify(miniSchema()));
    writeFileSync(join(committed, 'herdr-version.json'), JSON.stringify({ version: '0.9.5', protocol: 22 }));
    const schemaFile = join(committed, 'live.json');
    writeFileSync(schemaFile, JSON.stringify(miniSchema()));
    const fake = fakeHerdrDirectory(schemaFile);
    try {
      const run = runDrift(['--committed', committed], fake.env);
      assert.equal(run.status, DriftExitCode.Clean, run.stdout + run.stderr);
      assert.ok(run.stdout.includes('clean'), run.stdout);
    } finally {
      rmSync(fake.dir, { recursive: true, force: true });
      rmSync(committed, { recursive: true, force: true });
    }
  });

  // The real committed schema against a fake herdr that serves it: the only finding is the METHOD_RESULT gap, so the exit is 1 until P3 regenerates the table.
  test('the real committed schema against a fake herdr that serves it reports the known METHOD_RESULT gap (exit 1)', () => {
    const schemaFile = join(mkdtempSync(join(tmpdir(), 'herdr-drift-live-')), 'live.json');
    writeFileSync(schemaFile, committedSchemaText());
    const fake = fakeHerdrDirectory(schemaFile);
    try {
      const run = runDrift(['--committed', committedDirectory()], fake.env);
      assert.equal(run.status, DriftExitCode.Drift, run.stdout + run.stderr);
      assert.ok(run.stdout.includes('1 finding(s)'), run.stdout);
      const line = run.stdout.split('\n').find((text) => text.startsWith(UNMAPPED_LINE));
      assert.ok(line !== undefined, run.stdout);
      assert.equal(line.slice(UNMAPPED_LINE.length).split(', ').length, KNOWN_UNMAPPED_METHODS, line);
    } finally {
      rmSync(fake.dir, { recursive: true, force: true });
    }
  });

  test('a fake herdr that serves a moved protocol drifts (exit 1) and names it', () => {
    const schema = JSON.parse(committedSchemaText()) as { protocol: number };
    schema.protocol = 23;
    const liveDir = mkdtempSync(join(tmpdir(), 'herdr-drift-live-'));
    const schemaFile = join(liveDir, 'live.json');
    writeFileSync(schemaFile, JSON.stringify(schema));
    const fake = fakeHerdrDirectory(schemaFile);
    try {
      const run = runDrift(['--committed', committedDirectory()], fake.env);
      assert.equal(run.status, DriftExitCode.Drift, run.stdout + run.stderr);
      assert.ok(run.stdout.includes('protocol moved 22 -> 23'), run.stdout);
    } finally {
      rmSync(fake.dir, { recursive: true, force: true });
      rmSync(liveDir, { recursive: true, force: true });
    }
  });

  test('a committed directory that is missing is exit 3', () => {
    const empty = mkdtempSync(join(tmpdir(), 'herdr-drift-nocommitted-'));
    const fake = fakeHerdrDirectory(join(empty, 'unused.json'));
    try {
      const run = runDrift(['--committed', join(empty, 'nowhere')], fake.env);
      assert.equal(run.status, DriftExitCode.NotCovered);
      assert.ok(run.stderr.includes(ReasonText.CommittedMissing), run.stderr);
    } finally {
      rmSync(fake.dir, { recursive: true, force: true });
      rmSync(empty, { recursive: true, force: true });
    }
  });

  test('the committed version file is the package one', () => {
    assert.ok(committedVersionText().includes('"version"'), readFileSync(join(committedDirectory(), 'herdr-version.json'), 'utf8'));
  });
});
