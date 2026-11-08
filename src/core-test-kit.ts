// Role: the core test-kit entry ("./core/test-kit"): the fake herdr-core and the setup for tests of code built on the core client (imported by tests only).
// Informs HERDR-ADR-0020 (the herdr-core client); ported from the desktop work in herdr-plugins.
export { FakeFault, FakeHcCore, agentTerminal, frame, later, nextWithin, shellTerminal } from './core/test-kit/fake-core.ts';
export type { Handler, Seen } from './core/test-kit/fake-core.ts';
export { FAST_EVENTS, FAST_LINK, openWorld, setupTest } from './core/test-kit/setup-test.ts';
export type { DesktopWorld as CoreWorld } from './core/test-kit/setup-test.ts';
