# Changelog

All notable changes to `@stateforge-labs/herdr`. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow semver, below 1.0.0 a minor may break.

## 0.3.0 - unreleased

First release on the public npm registry.

### Added

- `@stateforge-labs/herdr/core`: a client of the herdr-core (`hc`) socket. `CoreLink` (calls with per-call timeouts, hello and
  generation check, reconnect with capped backoff), `CoreEvents` (the `events.subscribe` feed: snapshot, events, heartbeat watchdog,
  `missed` with a fresh snapshot), the wire parsers and `hcCoreSocketPath()`. Failures are `Unknown` values, never thrown.
- `@stateforge-labs/herdr/core/test-kit`: `FakeHcCore` scripted from recorded frames, `setupTest(t)` and `openWorld()`.
- `UnsupportedWatchError` (a `TypeError`) for a per-pane type `watchPaneSet` cannot follow yet.

### Changed

- The package is published as `@stateforge-labs/herdr` (earlier versions were private).
- Every error of the server client and its tools comes from one module; their names and messages are unchanged.
- The source tree is organised by product (`src/herdr/`, `src/core/`); the published subpaths are unchanged.

## 0.2.0 and 0.1.0

Private releases.
