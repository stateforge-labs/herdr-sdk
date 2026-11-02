// Role: the /mcp entry over the fake: a token from tokenFile() admits only the right bearer header, and only an admitted read reaches the server.
// Informs HERDR-ADR-0010 (the MCP add-on boundary) and plan 7 (lane P6c); cross-layer test. The toolkit (readOnlyToolkit) is not built yet, so the guard gates a direct read.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Method, ResultTag } from '../../src/index.ts';
import { connectReadOnly } from '../../src/read-only.ts';
import { bearerGuard, tokenFile } from '../../src/mcp.ts';
import { withFake } from '../support/fake.ts';

describe('/mcp bearer guard over the fake', () => {
  test('the stored token admits its own bearer header and refuses every other header before a read is sent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'herdr-mcp-'));
    try {
      await withFake({}, async (fake) => {
        fake.reply(Method.PaneList, { type: ResultTag.PaneList, panes: [] });
        const token = await tokenFile({ path: join(dir, 'token') }).readOrCreate();
        const admits = bearerGuard(token);
        const client = await connectReadOnly({ socketPath: fake.path });
        try {
          const readIfAdmitted = (header: string | undefined) =>
            admits(header) ? client.pane.list({}) : Promise.resolve(undefined);

          assert.equal(await readIfAdmitted(undefined), undefined);
          assert.equal(await readIfAdmitted(`Bearer not-${token}`), undefined);
          assert.equal(await readIfAdmitted(`Basic ${token}`), undefined);
          assert.deepEqual(fake.receivedMethods(), [Method.Ping]);

          const result = await readIfAdmitted(`Bearer ${token}`);
          assert.deepEqual(result, { type: ResultTag.PaneList, panes: [] });
          assert.deepEqual(fake.receivedMethods(), [Method.Ping, Method.PaneList]);
        } finally {
          client.close();
        }
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
