// Role: tests of the capture helpers (tools/scripts/capture-schema.ts); pure functions only, herdr is never executed.
// Informs HERDR-ADR-0009 (drift and protocol-tied versioning) and plan section 6 (capture).
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHerdrVersion, versionRecord } from '../../../tools/scripts/capture-schema.ts';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const COMMITTED_VERSION_PATH = join(TEST_DIR, '..', '..', '..', 'schema', 'herdr-version.json');

const HERDR_VERSION = '0.9.5';
const PROTOCOL = 22;
const CAPTURED_ON = new Date('2026-11-02T08:00:00Z');
const CAPTURED_TEXT = '2026-11-02';
const VERSION_OUTPUT = `herdr ${HERDR_VERSION}\n`;
const FOREIGN_OUTPUT = 'othertool 1.0.0\n';

describe('parseHerdrVersion', () => {
  test('reads the version from herdr --version output', () => {
    expect(parseHerdrVersion(VERSION_OUTPUT)).toBe(HERDR_VERSION);
  });

  test('refuses output that does not start with the herdr prefix', () => {
    expect(() => parseHerdrVersion(FOREIGN_OUTPUT)).toThrow('unexpected output');
  });

  test('refuses output with no version part', () => {
    expect(() => parseHerdrVersion('herdr\n')).toThrow('unexpected output');
  });
});

describe('versionRecord', () => {
  test('writes version, protocol and captured date in that key order, with a trailing newline', () => {
    const expected = `{\n  "version": "${HERDR_VERSION}",\n  "protocol": ${PROTOCOL},\n  "captured": "${CAPTURED_TEXT}"\n}\n`;
    expect(versionRecord(HERDR_VERSION, PROTOCOL, CAPTURED_ON)).toBe(expected);
  });

  test('the committed schema/herdr-version.json has the same shape', () => {
    const committed = JSON.parse(readFileSync(COMMITTED_VERSION_PATH, 'utf8')) as Record<string, unknown>;
    expect(Object.keys(committed)).toEqual(['version', 'protocol', 'captured']);
  });
});
