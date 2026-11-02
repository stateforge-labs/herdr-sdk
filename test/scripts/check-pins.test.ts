// Role: tests of the pin gate (scripts/check-pins.ts) with an injected registry lookup; no network, no npm.
// Informs HERDR-ADR-0015 (exact pins at least 14 days old) and plan section 2.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Lookup, Manifest, Pin } from '../../scripts/check-pins.ts';
import {
  ageInDays,
  checkPin,
  collectPins,
  DEPENDENCY_FIELDS,
  isExactVersion,
  MIN_AGE_DAYS,
  PIN_REASON,
  reportLine,
} from '../../scripts/check-pins.ts';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_MANIFEST = join(TEST_DIR, '..', '..', 'package.json');

const MS_PER_DAY = 86_400_000;
const NOW = new Date('2026-11-02T12:00:00Z');
const PACKAGE = { name: 'typescript', version: '7.0.2' } as const;
const PACKAGE_NAMES = { typescript: 'typescript', typesNode: '@types/node' } as const;
const VERSIONS = { typescript: '7.0.2', typesNode: '22.20.5' } as const;
const PRERELEASE = '7.0.0-dev.20260707.2';

const ACCEPTED_SPECS = [VERSIONS.typescript, PRERELEASE] as const;
const REJECTED_SPECS = ['^7.0.2', '~1', '>=1', '*', 'latest', 'workspace:*', 'file:../x', ''] as const;

function daysBefore(days: number, extraMs = 0): Date {
  return new Date(NOW.getTime() - days * MS_PER_DAY - extraMs);
}

function pinOf(spec: string): Pin {
  return { name: PACKAGE.name, spec, field: DEPENDENCY_FIELDS[1] };
}

function neverCalled(): Date | undefined {
  throw new Error('the registry must not be consulted for a range');
}

describe('isExactVersion', () => {
  test.each(ACCEPTED_SPECS)('accepts the exact version %s', (spec) => {
    expect(isExactVersion(spec)).toBe(true);
  });

  test.each(REJECTED_SPECS)('rejects the non-exact spec %p', (spec) => {
    expect(isExactVersion(spec)).toBe(false);
  });
});

describe('collectPins', () => {
  test('reads the four dependency tables and tags each pin with its field', () => {
    const manifest: Manifest = {
      dependencies: { alpha: '1.0.0' },
      devDependencies: { [PACKAGE_NAMES.typescript]: VERSIONS.typescript },
      peerDependencies: { beta: '2.0.0' },
      optionalDependencies: { gamma: '3.0.0' },
    };
    expect(collectPins(manifest)).toEqual([
      { name: 'alpha', spec: '1.0.0', field: DEPENDENCY_FIELDS[0] },
      { name: PACKAGE_NAMES.typescript, spec: VERSIONS.typescript, field: DEPENDENCY_FIELDS[1] },
      { name: 'beta', spec: '2.0.0', field: DEPENDENCY_FIELDS[2] },
      { name: 'gamma', spec: '3.0.0', field: DEPENDENCY_FIELDS[3] },
    ]);
  });

  test('the package manifest declares exactly the two dev pins, both exact', () => {
    const manifest = JSON.parse(readFileSync(PACKAGE_MANIFEST, 'utf8')) as Manifest;
    const pins = collectPins(manifest);
    expect(pins.map((pin) => [pin.name, pin.spec])).toEqual([
      [PACKAGE_NAMES.typesNode, VERSIONS.typesNode],
      [PACKAGE_NAMES.typescript, VERSIONS.typescript],
    ]);
    expect(pins.every((pin) => isExactVersion(pin.spec))).toBe(true);
  });
});

describe('ageInDays', () => {
  test('counts whole days and floors partial days', () => {
    expect(ageInDays(daysBefore(14, MS_PER_DAY / 2), NOW)).toBe(14);
  });

  test('a publication after now is negative', () => {
    expect(ageInDays(new Date(NOW.getTime() + MS_PER_DAY), NOW)).toBeLessThan(0);
  });
});

describe('checkPin', () => {
  test('13 days old is too new', () => {
    const lookup: Lookup = () => daysBefore(MIN_AGE_DAYS - 1);
    expect(checkPin(pinOf(VERSIONS.typescript), NOW, lookup)).toEqual({ ok: false, reason: PIN_REASON.tooNew });
  });

  test('exactly 14 days old is accepted', () => {
    const published = daysBefore(MIN_AGE_DAYS);
    const verdict = checkPin(pinOf(VERSIONS.typescript), NOW, () => published);
    expect(verdict).toEqual({ ok: true, published, ageDays: MIN_AGE_DAYS });
  });

  test('a version missing from the registry is unpublished', () => {
    const lookup: Lookup = () => undefined;
    expect(checkPin(pinOf('7.0.1'), NOW, lookup)).toEqual({ ok: false, reason: PIN_REASON.unpublished });
  });

  test('a range is refused without consulting the registry', () => {
    expect(checkPin(pinOf('^7.0.2'), NOW, neverCalled)).toEqual({ ok: false, reason: PIN_REASON.range });
  });

  test('the lookup receives the package name and the exact version', () => {
    const seen: string[] = [];
    const lookup: Lookup = (name, version) => {
      seen.push(`${name}@${version}`);
      return daysBefore(MIN_AGE_DAYS + 1);
    };
    checkPin(pinOf(PACKAGE.version), NOW, lookup);
    expect(seen).toEqual([`${PACKAGE.name}@${PACKAGE.version}`]);
  });
});

describe('reportLine', () => {
  test('an accepted pin shows its date, age and OK', () => {
    const published = daysBefore(20);
    const verdict = checkPin(pinOf(VERSIONS.typescript), NOW, () => published);
    expect(reportLine(pinOf(VERSIONS.typescript), verdict)).toBe(`typescript@7.0.2 2026-10-13 20d OK`);
  });

  test('a refused pin shows its reason', () => {
    const verdict = checkPin(pinOf('^7.0.2'), NOW, neverCalled);
    expect(reportLine(pinOf('^7.0.2'), verdict)).toBe(`typescript@^7.0.2 FAIL ${PIN_REASON.range}`);
  });
});
