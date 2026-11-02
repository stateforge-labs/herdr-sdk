// Role: the test-kit entry: the minimal fake herdr for tests (a subpath entry, imported by tests only).
// Informs plan 3 (test-kit.ts is the only entry that may import test-kit/) and HERDR-ADR-0003 (layers); test-kit imports wire and generated only.
export { createFakeHerdr } from './test-kit/fake-herdr.ts';
export type { FakeHerdr, FakeHerdrOptions } from './test-kit/fake-types.ts';
