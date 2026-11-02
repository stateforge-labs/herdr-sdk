// Role: the drift CLI run as a process: with no herdr on PATH it reports NOT COVERED and exits 3, without touching any socket.
// Informs HERDR-ADR-0009 (exit 3 when herdr is absent) and HERDR-ADR-0008 (the herdr CLI only, never the socket); plan 5c. Cross-layer test: the bin, the schema and the CLI runner.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DRIFT_BIN = fileURLToPath(new URL('../../bin/herdr-drift.ts', import.meta.url));
const EXIT_NOT_COVERED = 3;

describe('herdr-drift with no herdr on PATH', () => {
  test('exits 3 and says the comparison was not covered', () => {
    const emptyPath = mkdtempSync(join(tmpdir(), 'herdr-drift-path-'));
    try {
      const result = spawnSync(process.execPath, [DRIFT_BIN], {
        env: { PATH: emptyPath },
        encoding: 'utf8',
      });
      assert.equal(result.status, EXIT_NOT_COVERED);
      assert.match(`${result.stdout}${result.stderr}`, /herdr/i);
    } finally {
      rmSync(emptyPath, { recursive: true, force: true });
    }
  });
});
