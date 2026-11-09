# Changelog

All notable changes to `@stateforge-labs/herdr-sdk`. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow semver, below 1.0.0 a minor may break.

## Unreleased

### Added

- `./core`: `HcTerminal` and `parseHcTerminal`, the typed row of a live terminal that reports an agent under a labelled tab, with its field parsers (`parseHcAddress`, `parseHcPlacement`, `parseHcReport`, `parseHcForeground`), `hcAddressOf` and `hcTerminalEqual`; `parsePositiveCount` is re-exported. Hand-written reference in `docs/api/core.md`.
- `./core`: `CoreTerminals` makes the herdr-core reads typed (`list`, `get`, `read`) and settles each as an answer or an `Unknown`; `parseHcListing`, `parseHcScreen` and `lastLines` check the replies and trim a screen. The `lines` parameter of `terminal.read` is the history above the screen, and 0 is the visible screen only. `HcReadField`, `HcReadHow`, `HcReadWhy` and `HC_RPC_NOT_FOUND` describe the reply. Hand-written reference in `docs/api/core.md`.
- `./core`: `CoreRoster` folds the core feed (snapshot, events, missed) into a table of `HcTerminal` with typed added/changed/removed deltas and a revision; `HcEventType`, `HcPatchField`, `RosterChange` and `isHcEventType` describe the event vocabulary.
- `./core` exports `Brand`, `brand`, `ok`, `err`, `isFields` so a consumer's branded values share the SDK's brand marker.
- Main entry exports `UnsupportedWatchError`, `SubscriptionEventKind` and `ErrorCode` (`agent_blocked`, `agent_not_found`, `agent_prompt_stalled`).
- `watch()`: `Watch.update(subscriptions)` changes the subscription set (re-subscribes and yields a new `Live`); `WatchOptions.idleMs` resubscribes after that long without a frame. Reference in `docs/api/client.md`.
- `connectPlugin()` (main entry): the `connect()` surface plus `plugin.pane.open`, `plugin.pane.focus` and `plugin.pane.close`, for plugin authors. `PluginClient` and `ConnectPlugin` are its types. Reference in `docs/api/client.md`.

### Changed

- `plugin.pane.open`, `plugin.pane.focus` and `plugin.pane.close` return typed results (`plugin_pane_opened`, `plugin_pane_focused`, `plugin_pane_closed`) instead of `unknown`.

### Fixed

- `connect*()` honours `HERDR_SOCKET_PATH`, the variable herdr sets for plugins (before `HERDR_SOCKET`, which is kept). An empty variable counts as unset.
- Skill: the `./effect` row lists what the entry ships; `connectAdmin()` is 98 of the 102 methods (the four connection-scoped ones are on `hold()`).

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
