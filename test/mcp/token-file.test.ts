// Role: checks tokenFile: read-or-create in a temp dir, 0600 file in a 0700 dir, a well-formed token is kept, a malformed one replaced,
// and no error message contains the token. Informs HERDR-ADR-0010 and plan 7 (lane P6c). Temp dir only: never the home dir.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { McpToken } from '../../src/constants.ts';
import { tokenFile } from '../../src/mcp/token-file.ts';

const HEX_PATTERN = /^[0-9a-f]+$/;
const PERMISSION_BITS = 0o777;
const TEMP_DIR_PREFIX = 'herdr-mcp-test-';

let root: string;

// Fresh path under the temp root for each test, so tests never share a token file.
const pathFor = (name: string): string => join(root, name, 'token');

const modeOf = (path: string): number => statSync(path).mode & PERMISSION_BITS;

before(() => {
  root = mkdtempSync(join(tmpdir(), TEMP_DIR_PREFIX));
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('tokenFile', () => {
  test('creates a 64-character hex token in a 0600 file inside a 0700 directory', async () => {
    const path = pathFor('create');
    const token = await tokenFile({ path }).readOrCreate();
    assert.equal(token.length, McpToken.HexLength);
    assert.match(token, HEX_PATTERN);
    assert.equal(readFileSync(path, 'utf8'), token);
    assert.equal(modeOf(path), McpToken.FileMode);
    assert.equal(modeOf(join(root, 'create')), McpToken.DirMode);
  });

  test('creates the missing parent directories', async () => {
    const path = join(root, 'deep', 'nested', 'dir', 'token');
    await tokenFile({ path }).readOrCreate();
    assert.equal(statSync(path).isFile(), true);
  });

  test('returns the same token on a second call', async () => {
    const handle = tokenFile({ path: pathFor('second') });
    const first = await handle.readOrCreate();
    const second = await handle.readOrCreate();
    assert.equal(second, first);
  });

  test('keeps a well-formed token that is already in the file', async () => {
    const path = pathFor('existing');
    const existing = 'c'.repeat(McpToken.HexLength);
    mkdirSync(join(root, 'existing'), { recursive: true });
    writeFileSync(path, existing + '\n');
    assert.equal(await tokenFile({ path }).readOrCreate(), existing);
  });

  test('replaces a short token with a new well-formed one', async () => {
    const path = pathFor('short');
    mkdirSync(join(root, 'short'), { recursive: true });
    writeFileSync(path, 'abc');
    const token = await tokenFile({ path }).readOrCreate();
    assert.equal(token.length, McpToken.HexLength);
    assert.notEqual(token, 'abc');
  });

  test('replaces an empty file with a new well-formed token', async () => {
    const path = pathFor('empty');
    mkdirSync(join(root, 'empty'), { recursive: true });
    writeFileSync(path, '');
    const token = await tokenFile({ path }).readOrCreate();
    assert.equal(token.length, McpToken.HexLength);
  });

  test('tightens an existing 0644 file to 0600 before writing', async () => {
    const path = pathFor('loose');
    mkdirSync(join(root, 'loose'), { recursive: true });
    writeFileSync(path, 'd'.repeat(McpToken.HexLength));
    chmodSync(path, 0o644);
    await tokenFile({ path }).readOrCreate();
    assert.equal(modeOf(path), McpToken.FileMode);
  });

  test('reports a read failure with a fixed message that never contains the token', async () => {
    const path = pathFor('unreadable');
    mkdirSync(path, { recursive: true });
    const error = await tokenFile({ path }).readOrCreate().then(
      () => assert.fail('expected a read failure'),
      (failure: Error) => failure,
    );
    assert.equal(error.message, 'mcp token file could not be read');
  });

  test('reports a write failure with a fixed message that never contains the token', async () => {
    const path = pathFor('dangling');
    mkdirSync(join(root, 'dangling'), { recursive: true });
    symlinkSync(join(root, 'dangling', 'missing', 'target'), path);
    const error = await tokenFile({ path }).readOrCreate().then(
      () => assert.fail('expected a write failure'),
      (failure: Error) => failure,
    );
    assert.equal(error.message, 'mcp token file could not be written');
  });
});
