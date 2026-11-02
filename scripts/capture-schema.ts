// Role: `bun run capture`; writes herdr's published API schema and the installed herdr version record into schema/.
// Informs HERDR-ADR-0009 (drift and protocol-tied versioning) and plan section 6 (capture). Metadata only: never opens the herdr socket.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = join(PACKAGE_ROOT, 'schema', 'herdr-api.schema.json');
const VERSION_PATH = join(PACKAGE_ROOT, 'schema', 'herdr-version.json');

const HERDR_COMMAND = 'herdr';
const HERDR_ARGS = { version: '--version', schema: ['api', 'schema', '--json'] } as const;
const VERSION_PREFIX = 'herdr';
const VERSION_SEPARATOR = ' ';
const ISO_DATE_LENGTH = 10;
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
const JSON_INDENT = 2;

export interface VersionRecord {
  readonly version: string;
  readonly protocol: number;
  readonly captured: string;
}

// Reads `herdr <x.y.z>` (the output of `herdr --version`) and returns the version part.
export function parseHerdrVersion(stdout: string): string {
  const [prefix, version] = stdout.trim().split(VERSION_SEPARATOR);
  if (prefix !== VERSION_PREFIX || version === undefined || version.length === 0) {
    throw new Error(`unexpected output from 'herdr --version': '${stdout.trim()}'`);
  }
  return version;
}

// Text of schema/herdr-version.json: keys in fixed order, two-space JSON, trailing newline.
export function versionRecord(version: string, protocol: number, date: Date): string {
  const record: VersionRecord = {
    version,
    protocol,
    captured: date.toISOString().slice(0, ISO_DATE_LENGTH),
  };
  return `${JSON.stringify(record, null, JSON_INDENT)}\n`;
}

function protocolOf(schemaJson: string): number {
  const parsed = JSON.parse(schemaJson) as { readonly protocol?: unknown };
  if (typeof parsed.protocol !== 'number') {
    throw new Error('the captured schema carries no numeric protocol');
  }
  return parsed.protocol;
}

export function main(now: Date = new Date()): void {
  const schemaJson = execFileSync(HERDR_COMMAND, HERDR_ARGS.schema, {
    encoding: 'utf8',
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  const versionOutput = execFileSync(HERDR_COMMAND, [HERDR_ARGS.version], { encoding: 'utf8' });
  const version = parseHerdrVersion(versionOutput);
  const protocol = protocolOf(schemaJson);
  writeFileSync(SCHEMA_PATH, schemaJson);
  writeFileSync(VERSION_PATH, versionRecord(version, protocol, now));
  process.stdout.write(`captured herdr ${version} (protocol ${protocol}) -> schema/\n`);
}

if (import.meta.main) {
  main();
}
