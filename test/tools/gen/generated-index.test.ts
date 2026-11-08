// Role: tests that the committed src/herdr/generated index agrees with the package manifest, the schema version file and the method table.
// Informs HERDR-ADR-0002 and plan section 3.2 (PROTOCOL and SCHEMA_VERSION come from the schema; coverage of METHOD_RESULT is a subset of METHODS).
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAPABILITY_GATE, DEFAULT_RESULT, ENTRY_METHODS, LONG_POLL, Method, METHOD_RESULT, METHODS, PARAMS_SHAPE, PRESET_METHODS,
  PROTOCOL, SCHEMA_VERSION, STREAM_RETURNS, TOKEN_NAME_PATTERN,
} from '../../../src/herdr/generated/index.ts';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const MANIFEST_PATH = join(PACKAGE_ROOT, 'package.json');
const VERSION_PATH = join(PACKAGE_ROOT, 'schema', 'herdr-version.json');

interface Manifest {
  readonly herdr: { readonly protocol: number; readonly schemaVersion: number; readonly testedWith: string };
}

interface VersionRecord {
  readonly version: string;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

const manifest = readJson<Manifest>(MANIFEST_PATH);
const versionRecord = readJson<VersionRecord>(VERSION_PATH);

describe('generated index against the package manifest', () => {
  test('PROTOCOL is the protocol the manifest declares', () => {
    expect(PROTOCOL).toBe(manifest.herdr.protocol);
  });

  test('SCHEMA_VERSION is the schema version the manifest declares', () => {
    expect(SCHEMA_VERSION).toBe(manifest.herdr.schemaVersion);
  });

  test('the captured herdr version is the one the manifest says it was tested with', () => {
    expect(versionRecord.version).toBe(manifest.herdr.testedWith);
  });
});

describe('METHOD_RESULT against METHODS', () => {
  test('every key of METHOD_RESULT is a method name', () => {
    const names = new Set(METHODS.map((row) => row.name));
    for (const method of Object.keys(METHOD_RESULT)) {
      expect(names.has(method)).toBe(true);
    }
  });
});

describe('the new public exports', () => {
  test('the name tables, defaults, shapes and overrides are exported', () => {
    expect(Method.PaneList).toBe('pane.list');
    expect(typeof TOKEN_NAME_PATTERN).toBe('string');
    expect(Object.keys(DEFAULT_RESULT).length).toBe(63);
    expect(Object.keys(PARAMS_SHAPE).length).toBe(METHODS.length);
    expect(LONG_POLL['agent.start']?.timeoutPath).toEqual(['timeout_ms']);
    expect(STREAM_RETURNS['events.subscribe']).toBe('Subscription');
    expect(CAPABILITY_GATE['server.live_handoff']).toBe('live_handoff');
    expect(ENTRY_METHODS.held).toEqual(['client.window_title.clear', 'client.window_title.set', 'client_shell.surface.set', 'server.ssh_agent.register']);
    expect(PRESET_METHODS.SessionsReader).toContain('pane.list');
  });
});
