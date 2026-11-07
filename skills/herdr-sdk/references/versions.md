# Versions, upgrades, drift

- The package version follows herdr: a protocol change, or a removed, renamed or narrowed API, is a major; added methods and events are a minor; everything else is a patch. The package.json `herdr` field has `protocol`, `schemaVersion` and `testedWith`.
- `connect()` checks the server's protocol and rejects with `ProtocolMismatchError` unless it matches exactly (`protocolPolicy: ProtocolPolicy.Minimum` accepts a newer server).
- The generated reference ships with the package: `docs/api/methods.md` (102 methods, params type, result tag, capability class, long-poll, server capability gate) and `docs/api/events.md` (event kinds and subscription types). Read these instead of guessing a name.
- `herdr-drift` (bin) compares the committed schema with the installed herdr: exit 0 clean, 1 drift, 2 usage, 3 herdr not found or unreadable schema (3 means "could not look", never green).
- When herdr upgrades: run `herdr-drift`; if only additions, bump the minor; if it reports removals, treat it as a major and re-read `docs/api/methods.md`.
