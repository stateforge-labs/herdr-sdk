# Changelog

All notable changes to `@stateforge-labs/herdr-sdk`. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow semver, below 1.0.0 a minor may break.

## Unreleased

## 0.3.1 - 2026-11-08

### Added

- Community health files: `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` and `SUPPORT.md`, and GitHub issue forms for bugs and feature requests.
- The README now has requirements, a table of contents, support, contributing and security sections, expected output for the first example, and a reference for `herdr-drift` and `herdr-skill` with their exit codes.
- `renovate.json` for the project's GitLab, with a 14-day release age.

### Changed

- The README describes only the published package. The repository layout, the drift workflow and the measured size table moved to `CONTRIBUTING.md`.
- `CHANGELOG.md` ships in the package. The package declares `main` and `types` fallbacks for tools that do not read `exports`.
- `NOTICE.md` and the README no longer cite a commit of an unpublished intermediate port.

## 0.3.0 - 2026-11-08

First release on the public npm registry.

### Added

- `@stateforge-labs/herdr-sdk/core`: a client of the herdr-core (`hc`) socket. `CoreLink` (calls with per-call timeouts, hello and
  generation check, reconnect with capped backoff), `CoreEvents` (the `events.subscribe` feed: snapshot, events, heartbeat watchdog,
  `missed` with a fresh snapshot), the wire parsers and `hcCoreSocketPath()`. Failures are `Unknown` values, never thrown.
- `@stateforge-labs/herdr-sdk/core/test-kit`: `FakeHcCore` scripted from recorded frames, `setupTest(t)` and `openWorld()`.
- `UnsupportedWatchError` (a `TypeError`) for a per-pane type `watchPaneSet` cannot follow yet.

### Changed

- The package is published as `@stateforge-labs/herdr-sdk` (earlier versions were private).
- Every error of the server client and its tools comes from one module; their names and messages are unchanged.
- The source tree is organised by product (`src/herdr/`, `src/core/`); the published subpaths are unchanged.

## 0.2.0 and 0.1.0

Private releases.

[Unreleased]: https://github.com/stateforge-labs/herdr-sdk/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/stateforge-labs/herdr-sdk/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/stateforge-labs/herdr-sdk/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/stateforge-labs/herdr-sdk/tree/v0.2.0
