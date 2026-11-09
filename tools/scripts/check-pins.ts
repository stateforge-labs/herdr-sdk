// Role: gate script `bun run check:pins`; every dependency pin is an exact version; each is released at least MIN_AGE_DAYS ago unless it is in our own scope (EXEMPT_SCOPE), which is exempt from the age only.
// Informs HERDR-ADR-0015 (exact pins, 14-day age rule) and plan section 2 (dependency policy).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIN_AGE_DAYS = 14;
export const EXEMPT_SCOPE = '@stateforge-labs/';

const MS_PER_DAY = 86_400_000;
const NOT_FOUND = -1;
const ISO_DATE_LENGTH = 10;
const CORE_PART_COUNT = 3;
const NPM_COMMAND = 'npm';
const NPM_VIEW_ARGS = { view: 'view', field: 'time', json: '--json' } as const;

export const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

export type DependencyField = (typeof DEPENDENCY_FIELDS)[number];

export const PIN_REASON = {
  range: 'range',
  tooNew: 'tooNew',
  unpublished: 'unpublished',
} as const;

export type PinReason = (typeof PIN_REASON)[keyof typeof PIN_REASON];

export const PIN_LABEL = { ok: 'OK', fail: 'FAIL' } as const;

export const EXIT_CODE = { ok: 0, fail: 1 } as const;

const SEPARATOR = { core: '.', prerelease: '-' } as const;
const CHARSET = {
  digits: '0123456789',
  prerelease: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-.',
} as const;

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANIFEST_PATH = join(PACKAGE_ROOT, 'package.json');

export type DependencyTable = Readonly<Record<string, string>>;

export type Manifest = Readonly<Partial<Record<DependencyField, DependencyTable>>>;

export interface Pin {
  readonly name: string;
  readonly spec: string;
  readonly field: DependencyField;
}

export type Lookup = (name: string, version: string) => Date | undefined;

export type PinVerdict =
  | { readonly ok: true; readonly published: Date; readonly ageDays: number }
  | { readonly ok: false; readonly reason: PinReason };

export interface PinReport {
  readonly line: string;
  readonly ok: boolean;
}

export function collectPins(manifest: Manifest): readonly Pin[] {
  return DEPENDENCY_FIELDS.flatMap((field) =>
    Object.entries(manifest[field] ?? {}).map(([name, spec]) => ({ name, spec, field })),
  );
}

function isDigits(text: string): boolean {
  return text.length > 0 && [...text].every((char) => CHARSET.digits.includes(char));
}

function isPrerelease(text: string): boolean {
  return text.length > 0 && [...text].every((char) => CHARSET.prerelease.includes(char));
}

export function isExemptFromAge(name: string): boolean {
  return name.startsWith(EXEMPT_SCOPE);
}

// True only for MAJOR.MINOR.PATCH with an optional -prerelease; ranges, tags and URLs are refused.
export function isExactVersion(spec: string): boolean {
  const dash = spec.indexOf(SEPARATOR.prerelease);
  const core = dash === NOT_FOUND ? spec : spec.slice(0, dash);
  const parts = core.split(SEPARATOR.core);
  const coreIsExact = parts.length === CORE_PART_COUNT && parts.every(isDigits);
  if (dash === NOT_FOUND) {
    return coreIsExact;
  }
  return coreIsExact && isPrerelease(spec.slice(dash + 1));
}

// Whole days between publication and now; a publication in the future is negative and therefore too new.
export function ageInDays(published: Date, now: Date): number {
  return Math.floor((now.getTime() - published.getTime()) / MS_PER_DAY);
}

// Registry lookup through the npm CLI (read-only metadata); undefined when the version is not published.
export function publishedAt(name: string, version: string): Date | undefined {
  const stdout = execFileSync(NPM_COMMAND, [NPM_VIEW_ARGS.view, name, NPM_VIEW_ARGS.field, NPM_VIEW_ARGS.json], {
    encoding: 'utf8',
  });
  const times = JSON.parse(stdout) as DependencyTable;
  const stamp = times[version];
  return stamp === undefined ? undefined : new Date(stamp);
}

export function checkPin(pin: Pin, now: Date, lookup: Lookup): PinVerdict {
  if (!isExactVersion(pin.spec)) {
    return { ok: false, reason: PIN_REASON.range };
  }
  const published = lookup(pin.name, pin.spec);
  if (published === undefined) {
    return { ok: false, reason: PIN_REASON.unpublished };
  }
  const ageDays = ageInDays(published, now);
  if (ageDays < MIN_AGE_DAYS && !isExemptFromAge(pin.name)) {
    return { ok: false, reason: PIN_REASON.tooNew };
  }
  return { ok: true, published, ageDays };
}

export function reportLine(pin: Pin, verdict: PinVerdict): string {
  const head = `${pin.name}@${pin.spec}`;
  if (!verdict.ok) {
    return `${head} ${PIN_LABEL.fail} ${verdict.reason}`;
  }
  const date = verdict.published.toISOString().slice(0, ISO_DATE_LENGTH);
  return `${head} ${date} ${verdict.ageDays}d ${PIN_LABEL.ok}`;
}

export function reportPins(manifest: Manifest, now: Date, lookup: Lookup): readonly PinReport[] {
  return collectPins(manifest).map((pin) => {
    const verdict = checkPin(pin, now, lookup);
    return { line: reportLine(pin, verdict), ok: verdict.ok };
  });
}

export function main(manifestPath: string = MANIFEST_PATH, now: Date = new Date()): number {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
  const reports = reportPins(manifest, now, publishedAt);
  for (const report of reports) {
    process.stdout.write(`${report.line}\n`);
  }
  return reports.every((report) => report.ok) ? EXIT_CODE.ok : EXIT_CODE.fail;
}

if (import.meta.main) {
  process.exit(main());
}
