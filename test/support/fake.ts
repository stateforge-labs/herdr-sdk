// Role: runs a test against its own fake herdr and stops the fake afterwards, even when the test fails.
// Informs HERDR-ADR-0008 (every test owns its fake; no shared state between tests) and plan 5; new test helper.
import { createFakeHerdr } from '../../src/test-kit.ts';
import type { FakeHerdr, FakeHerdrOptions } from '../../src/test-kit.ts';

export async function withFake(options: FakeHerdrOptions, run: (fake: FakeHerdr) => Promise<void>): Promise<void> {
  const fake = await createFakeHerdr(options);
  try {
    await run(fake);
  } finally {
    await fake.stop();
  }
}
