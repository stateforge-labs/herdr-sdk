// Role: checks the schema sources with injected fakes: a missing herdr, a bad JSON copy, a missing committed file, and the version parse.
// Informs HERDR-ADR-0009 (could not look is NotFound or Unreadable, both exit 3) and HERDR-ADR-0008 (fakes only, never the real herdr); new test for lane P5c.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SchemaReadKind } from '../../src/constants.ts';
import { ReasonText } from '../../src/drift/constants.ts';
import { committedSource, installedSource, parseSchemaText } from '../../src/drift/schema.ts';
import type { SchemaDocument } from '../../src/drift/types.ts';
import { miniSchema } from './support/mini-schema.ts';

const DIR = '/fake/schema';
const SCHEMA_JSON = JSON.stringify(miniSchema());
const VERSION_JSON = JSON.stringify({ version: '0.9.5', protocol: 22 });

// A fake that throws the way a missing executable does (node sets code ENOENT).
function missingExecutable(): never {
  throw Object.assign(new Error('spawn herdr ENOENT'), { code: 'ENOENT' });
}

function filesOf(files: Readonly<Record<string, string>>) {
  return (path: string): string => {
    const text = files[path];
    if (text === undefined) {
      throw Object.assign(new Error(`no such file ${path}`), { code: 'ENOENT' });
    }
    return text;
  };
}

describe('committedSource', () => {
  test('reads the schema and the version from the directory', async () => {
    const source = committedSource(DIR, filesOf({
      [`${DIR}/herdr-api.schema.json`]: SCHEMA_JSON,
      [`${DIR}/herdr-version.json`]: VERSION_JSON,
    }));
    const read = await source();
    assert.equal(read.kind, SchemaReadKind.Found);
    assert.equal(read.kind === SchemaReadKind.Found ? read.herdrVersion : '', '0.9.5');
  });

  test('a missing committed schema is NotFound', async () => {
    const read = await committedSource(DIR, filesOf({}))();
    assert.deepEqual(read, { kind: SchemaReadKind.NotFound, reason: ReasonText.CommittedMissing });
  });

  test('a committed schema that exists but cannot be read is Unreadable, not NotFound', async () => {
    const denied = (path: string): string => {
      if (path.endsWith('herdr-api.schema.json')) {
        throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      }
      return VERSION_JSON;
    };
    const read = await committedSource(DIR, denied)();
    assert.deepEqual(read, { kind: SchemaReadKind.Unreadable, reason: ReasonText.CommittedUnreadable });
  });

  test('a committed schema path that is a directory is Unreadable', async () => {
    const isDirectory = (path: string): string => {
      if (path.endsWith('herdr-api.schema.json')) {
        throw Object.assign(new Error('illegal operation on a directory'), { code: 'EISDIR' });
      }
      return VERSION_JSON;
    };
    const read = await committedSource(DIR, isDirectory)();
    assert.equal(read.kind, SchemaReadKind.Unreadable);
  });

  test('a committed version file that cannot be read is Unreadable, and a missing one is NotFound', async () => {
    const denied = (path: string): string => {
      if (path.endsWith('herdr-version.json')) {
        throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      }
      return SCHEMA_JSON;
    };
    assert.deepEqual(await committedSource(DIR, denied)(), { kind: SchemaReadKind.Unreadable, reason: ReasonText.VersionFileUnreadable });
    const missing = (path: string): string => {
      if (path.endsWith('herdr-version.json')) {
        throw Object.assign(new Error('no such file'), { code: 'ENOENT' });
      }
      return SCHEMA_JSON;
    };
    assert.deepEqual(await committedSource(DIR, missing)(), { kind: SchemaReadKind.NotFound, reason: ReasonText.VersionMissing });
  });

  test('a committed schema that is not JSON is Unreadable', async () => {
    const read = await committedSource(DIR, filesOf({
      [`${DIR}/herdr-api.schema.json`]: '{not json',
      [`${DIR}/herdr-version.json`]: VERSION_JSON,
    }))();
    assert.deepEqual(read, { kind: SchemaReadKind.Unreadable, reason: ReasonText.NotJson });
  });
});

describe('installedSource', () => {
  test('a runner that cannot find herdr is NotFound with the reason', async () => {
    const read = await installedSource(missingExecutable)();
    assert.deepEqual(read, { kind: SchemaReadKind.NotFound, reason: ReasonText.HerdrMissing });
  });

  test('a runner that fails to run for another reason is Unreadable, not NotFound', async () => {
    const read = await installedSource(() => {
      throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
    })();
    assert.deepEqual(read, { kind: SchemaReadKind.Unreadable, reason: ReasonText.HerdrRefused });
  });

  test('a runner that exits non-zero is Unreadable', async () => {
    const read = await installedSource(() => {
      throw Object.assign(new Error('exit 1'), { code: 1 });
    })();
    assert.deepEqual(read, { kind: SchemaReadKind.Unreadable, reason: ReasonText.HerdrRefused });
  });

  test('a version line with a semantic version is read', async () => {
    const read = await installedSource((args) => (args[0] === '--version' ? 'herdr 0.9.6\n' : SCHEMA_JSON))();
    assert.equal(read.kind === SchemaReadKind.Found ? read.herdrVersion : '', '0.9.6');
  });

  test('a version output without a version is Unreadable', async () => {
    const read = await installedSource((args) => (args[0] === '--version' ? 'no version here' : SCHEMA_JSON))();
    assert.deepEqual(read, { kind: SchemaReadKind.Unreadable, reason: ReasonText.HerdrVersionMissing });
  });
});

describe('parseSchemaText', () => {
  test('bad JSON is Unreadable', () => {
    assert.deepEqual(parseSchemaText('{', '0.9.5'), { kind: SchemaReadKind.Unreadable, reason: ReasonText.NotJson });
  });

  test('a document without a protocol number is Unreadable', () => {
    assert.deepEqual(parseSchemaText('{"schemas":{}}', '0.9.5'), { kind: SchemaReadKind.Unreadable, reason: ReasonText.NoProtocol });
  });

  test('a document with a protocol number is Found with its version', () => {
    const read = parseSchemaText(SCHEMA_JSON, '0.9.5');
    assert.equal(read.kind, SchemaReadKind.Found);
    assert.deepEqual(read.kind === SchemaReadKind.Found ? read.schema : {}, miniSchema() as SchemaDocument);
  });
});
