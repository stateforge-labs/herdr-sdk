# @stateforge-labs/herdr-sdk

[![npm version](https://img.shields.io/npm/v/@stateforge-labs/herdr-sdk.svg)](https://www.npmjs.com/package/@stateforge-labs/herdr-sdk)
[![CI](https://github.com/stateforge-labs/herdr-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/stateforge-labs/herdr-sdk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/stateforge-labs/herdr-sdk/blob/main/LICENSE)

Typed client for the herdr socket API (protocol 22), generated from herdr's published schema.

**Requirements:** Node 22.18 or later, or Bun. ESM only. The declarations need `@types/node` 22 or later (see [Footprint](#footprint)). The client talks to a running [herdr](https://herdr.dev) over its unix socket.

## Contents

- [Entry points](#entry-points)
- [Install](#install)
- [Footprint](#footprint)
- [1. A small script (Promise API)](#1-a-small-script-promise-api)
- [2. Subscriptions, long-poll and held connections](#2-subscriptions-long-poll-and-held-connections)
- [3. Read-only and prompt-only clients](#3-read-only-and-prompt-only-clients)
- [4. Effect: tagged errors](#4-effect-tagged-errors)
- [5. Tests without a live herdr](#5-tests-without-a-live-herdr)
- [Command-line tools](#command-line-tools)
- [API reference](#api-reference)
- [For coding agents (the skill)](#for-coding-agents-the-skill)
- [Using it from your own domain](#using-it-from-your-own-domain)
- [Support](#support)
- [Contributing](#contributing)
- [Security](#security)
- [Changelog](#changelog)
- [Maintainers and credits](#maintainers-and-credits)
- [License](#license)

The package covers the whole herdr socket API (protocol 22, herdr 0.9.5: 102 methods, 26 event kinds, 27 subscription types), for Bun and Node. It includes the Promise API, the herdr-core client (`/core`, `/core/test-kit`), three capability-scoped clients, a fake herdr for tests (`/test-kit`), the schema and drift tools, the tagged errors of `/effect`, and an agent skill. Every snippet marked "runs" is executed in CI against the fake herdr.

## Entry points

| Import | What | Runtime deps |
|---|---|---|
| `@stateforge-labs/herdr-sdk` | `connect()`: reads, writes, input, hooks, long-poll, `hold()`; errors; generated types and constants | none |
| `@stateforge-labs/herdr-sdk/read-only` | `connectReadOnly()`: structure reads only; terminal content on opt-in | none |
| `@stateforge-labs/herdr-sdk/admin` | `connectAdmin()`: adds destructive, server-control and spawn/execute methods | none |
| `@stateforge-labs/herdr-sdk/effect` | `toTaggedError`, `EffectErrorTag` and the tagged error types, for mapping the Promise errors into an Effect program | none |
| `@stateforge-labs/herdr-sdk/test-kit` | `createFakeHerdr()` (tests only) | none |
| `@stateforge-labs/herdr-sdk/schema` | method table and parameter shapes of the generated API (what a generator, such as an MCP server, builds its tools from) | none |
| `@stateforge-labs/herdr-sdk/core` | `CoreLink`, `CoreEvents`, the wire parsers and the socket path rule: a client of the herdr-core (`hc`) socket, standalone from the protocol-22 client | none |
| `@stateforge-labs/herdr-sdk/core/test-kit` | `FakeHcCore`, `setupTest(t)`, `openWorld()` (tests only) | none |
| `@stateforge-labs/herdr-sdk/drift` | `driftBetween`, `inventoryOf`, `exitCodeFor`: the library behind `herdr-drift`, for your own tooling | none |
| `herdr-drift` (bin) | compare the committed schema with the installed herdr | none |
| `herdr-skill` (bin) | print or install the agent skill that ships in `skills/herdr-sdk` | none |

Wire types are `export type` only. Raw strings are accepted by the types, but these docs always use the generated constants (`Method`, `EventKind`, `SubscriptionType`, `AgentStatus`, `WatchKind`).

## Install

```sh
npm install @stateforge-labs/herdr-sdk
# or
bun add @stateforge-labs/herdr-sdk
```

The package is ESM only. It has `main` and `types` fields for older tooling, and `exports` for everything else. The release tag equals the `package.json` version. Versions published from GitHub Actions with npm trusted publishing carry a provenance attestation; `npm audit signatures` checks it.

## Footprint

The package ships compiled ESM in `dist/` with declarations (no bundle) and has no runtime dependencies. A bundler or Node loads only the modules a call reaches: `connect()` does not load the streams until `events.subscribe`, `watch()` or `hold()` is first used.

The declarations use `AbortSignal` and `AsyncDisposable`. Consumers need `@types/node` 22 or later, or a `lib` that has them (`es2023`, `esnext.disposable`, and `DOM` or `@types/node`). `/test-kit` declarations also import `node:net`.

## 1. A small script (Promise API)

```ts
import { connect, HerdrError } from "@stateforge-labs/herdr-sdk"

const herdr = await connect() // finds the socket (HERDR_SOCKET, else ~/.config/herdr/herdr.sock), pings, checks protocol 22

const { agents } = await herdr.agent.list({})
for (const agent of agents) console.log(agent.name, agent.agent_status)

try {
  await herdr.agent.prompt({ target: "reviewer", text: "run the tests" })
} catch (error) {
  if (error instanceof HerdrError) console.error(error.code, error.message)
  else throw error
}

herdr.close()
```

Expected output, with a running herdr that has two agents (one line per agent: its name and `agent_status`, which is `idle`, `working`, `blocked`, `done` or `unknown`):

```text
reviewer idle
builder working
```

The `prompt` call prints nothing when it succeeds. If the target is refused, the catch block prints the herdr error code and message to stderr.

Without a running herdr, `connect()` rejects before any call is made. The snippet above does not catch that error, so Node prints the uncaught error and exits with a non-zero status. The error is a `HerdrTransportError` whose message is `no herdr socket at <path>`, where `<path>` is `HERDR_SOCKET` or the default socket path. Catch it when your script must run without herdr.

Methods are nested by their dotted name: `herdr.pane.list({})`, `herdr.agent.view.set({...})`. `connect()` has no destructive or server-control methods (`*.close`, `server.stop`, `plugin.link`...); those need `connectAdmin()` from `@stateforge-labs/herdr-sdk/admin`.

A protocol mismatch fails fast; a method the server does not support fails before sending:

```ts
import { connect, ProtocolMismatchError } from "@stateforge-labs/herdr-sdk"

try {
  await connect()
} catch (error) {
  if (error instanceof ProtocolMismatchError) console.error(`herdr speaks ${error.actual}, this library ${error.expected}`)
}
```

## 2. Subscriptions, long-poll and held connections

```ts
import { connect, SubscriptionType, EventKind, AgentStatus, WatchKind } from "@stateforge-labs/herdr-sdk"

const herdr = await connect({ onCall: ({ method, durationMs, outcome }) => metrics.record(method, durationMs, outcome) })

const subscription = await herdr.events.subscribe([
  { type: SubscriptionType.PaneCreated },
  { type: SubscriptionType.PaneClosed },
  { type: SubscriptionType.PaneAgentStatusChanged, pane_id: "p_1" },
])
for await (const frame of subscription) {
  if (frame.event === EventKind.PaneClosed) break
}
subscription.close()

// Long-poll: the timeout is required (herdr would wait forever).
const done = await herdr.agent.wait({ target: "reviewer", until: [AgentStatus.Done], timeout_ms: 60_000 })

// watch: subscribe, snapshot, replay frames that arrived meanwhile, resubscribe with backoff (1 s doubling to 30 s).
for await (const change of herdr.watch({ snapshot: () => herdr.session.snapshot({}) })) {
  if (change.kind === WatchKind.Live) render(change.snapshot)
  else apply(change.frame)
}

// Connection-bound methods run on a held connection; closing it ends the title, lease or registration.
await using held = await herdr.hold()
await held.client.window_title.set({ title: "review" })
```

A timeout is not proof that a prompt was not delivered: never resend blindly.

## 3. Read-only and prompt-only clients

```ts
import { connectReadOnly, Presets } from "@stateforge-labs/herdr-sdk/read-only"

const herdr = await connectReadOnly({ preset: Presets.SessionsReader }) // session.snapshot, agent.list, agent.get, pane.get, pane.list
const snapshot = await herdr.session.snapshot({})
// @ts-expect-error a read-only client has no write methods and no generic call()
await herdr.agent.prompt({ target: "x", text: "y" })
```

Without options it allows structure reads and long-poll; terminal content (`pane.read`, `agent.read`) needs `{ content: true }`. `{ methods: [Method.AgentList, ...] }` narrows at runtime. `connectPrompt()` adds exactly `agent.prompt`.

## 4. Effect: tagged errors

`toTaggedError(error)` turns an error thrown by the Promise API into a plain object with an Effect-style `_tag`, so an Effect program can fail with it (`Effect.tryPromise({ try, catch: toTaggedError })`). The package does not depend on `effect`.

| Promise error | Effect `_tag` | Fields |
|---|---|---|
| `HerdrError` | `HerdrRefused` | `method`, `code`, `message` |
| `HerdrTransportError`, `SubscriptionEnded` | `HerdrUnavailable` | `cause`, `isTimeout` |
| `ProtocolMismatchError` | `ProtocolMismatch` | `expected`, `actual` |
| `UnsupportedByServerError` | `HerdrUnsupported` | `method`, `capability` |

Every tagged error also has `message` (the Promise error's message).

## 5. Tests without a live herdr

```ts
import { test, expect } from "bun:test"
import { connect, Method, ResultTag } from "@stateforge-labs/herdr-sdk"
import { createFakeHerdr } from "@stateforge-labs/herdr-sdk/test-kit"

test("lists agents", async () => {
  const fake = await createFakeHerdr()
  fake.reply(Method.AgentList, { type: ResultTag.AgentList, agents: [] })
  const herdr = await connect({ socketPath: fake.path })

  await herdr.agent.list({})

  expect(fake.receivedMethods()).toEqual([Method.Ping, Method.AgentList])
  herdr.close()
  await fake.stop()
})
```

The fake runs on `node:net`, answers `ping` and every method you script with `reply`, answers an unscripted method with an `unknown_method` error envelope, and supports `fail`, `silent`, `replySequence`, `push(frame)`, `closeSubscribers()`, `subscriberCount()`, `connectionCount()` and `capabilities`. No test in the package talks to a real herdr.

## Command-line tools

Both bins are plain Node scripts, installed with the package. Run them from a project that depends on the package, or without installing:

```sh
npx -p @stateforge-labs/herdr-sdk herdr-drift
npx -p @stateforge-labs/herdr-sdk herdr-skill print
```

### herdr-drift

`herdr-drift` answers one question: does the schema the package was built from still match the herdr installed on this machine? It runs the `herdr` CLI (it never connects to the socket) and compares the protocol number, the herdr version, the methods, the result tags, the event kinds and the subscribable types. It also reports changed field shapes and methods without a result row.

```sh
herdr-drift [--committed <dir>] [--herdr <bin>] [--json] [--help]
```

| Flag | Meaning |
|---|---|
| `--committed <dir>` | directory holding `herdr-api.schema.json` and `herdr-version.json` (default: the schema shipped in the package) |
| `--herdr <bin>` | the herdr binary to ask (default: `herdr` on `PATH`) |
| `--json` | print the report as JSON |
| `--help` | print usage and exit 0 |

| Exit code | Meaning |
|---|---|
| 0 | the copy matches the installed herdr |
| 1 | the schema drifted; the report names what was added and removed |
| 2 | misuse: an unknown flag or argument (usage goes to stderr) |
| 3 | not covered: herdr is not on `PATH`, or its live schema cannot be read |

### herdr-skill

`herdr-skill` prints or installs the agent skill that ships in the package (see [For coding agents](#for-coding-agents-the-skill)).

| Command | Meaning |
|---|---|
| `herdr-skill print` | print `SKILL.md` to stdout |
| `herdr-skill path` | print the directory of the skill inside the installed package |
| `herdr-skill install [skills-dir]` | copy the skill to `<skills-dir>/herdr-sdk` (default `.claude/skills`); an existing copy is replaced |

Exit codes: 0 on success, 2 on a usage error.

## API reference

- [Methods](https://github.com/stateforge-labs/herdr-sdk/blob/main/docs/api/methods.md): every method, its parameters and its result.
- [Events](https://github.com/stateforge-labs/herdr-sdk/blob/main/docs/api/events.md): every event kind and subscription type, and the shape of each frame.

The generated types are in the package itself (`dist/**/*.d.ts`), and your editor shows them on hover.

## For coding agents (the skill)

The package ships an Agent Skill, `skills/herdr-sdk/` ([HERDR-ADR-0018](https://github.com/stateforge-labs/herdr-sdk/blob/main/docs/decisions/HERDR-ADR-0018-the-skill-ships-in-the-package.md)): which entry point to pick, recipes, errors, version facts. Its code blocks are type-checked and run against the fake in the repository's `test/skill/`.

```sh
herdr-skill install              # copies it to .claude/skills/herdr-sdk (or: herdr-skill install ~/.claude/skills)
herdr-skill print                # prints SKILL.md, for agents that take a prompt rather than a folder
```

Claude Code does not look inside `node_modules`, so `install` copies the skill to a skills directory. For other agents, add this to the project's `AGENTS.md`:

> Code that uses `@stateforge-labs/herdr-sdk`: read `node_modules/@stateforge-labs/herdr-sdk/skills/herdr-sdk/SKILL.md` first.

## Using it from your own domain

The library conforms to herdr's wire vocabulary. Keep your own domain language behind your own port, and let one adapter file import `@stateforge-labs/herdr-sdk`. Snapshot before you subscribe, because a subscription delivers changes, not the present. `watch()` does this for you. The [decision records](https://github.com/stateforge-labs/herdr-sdk/tree/main/docs/decisions) explain the design.

## Support

Ask questions and report bugs in [GitHub issues](https://github.com/stateforge-labs/herdr-sdk/issues). Help is best effort. See [SUPPORT.md](https://github.com/stateforge-labs/herdr-sdk/blob/main/SUPPORT.md).

## Contributing

Issues and questions go to GitHub. Code changes are reviewed and merged through the project's GitLab, so pull requests opened on GitHub are not merged there. The setup, checks, generated code, and release steps are in [CONTRIBUTING.md](https://github.com/stateforge-labs/herdr-sdk/blob/main/CONTRIBUTING.md). The [Code of Conduct](https://github.com/stateforge-labs/herdr-sdk/blob/main/CODE_OF_CONDUCT.md) applies to every space.

## Security

Report vulnerabilities privately, through GitHub private vulnerability reporting, not in a public issue. See [SECURITY.md](https://github.com/stateforge-labs/herdr-sdk/blob/main/SECURITY.md) for the supported versions, the response time and the disclosure timeline.

## Changelog

Release notes are in [CHANGELOG.md](https://github.com/stateforge-labs/herdr-sdk/blob/main/CHANGELOG.md), in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

## Maintainers and credits

Maintained by [stateforge-labs](https://github.com/stateforge-labs).

This package is derived from [brooswit-factory/jsHerdrSDK](https://github.com/brooswit-factory/jsHerdrSDK) (commit `e34fd3f`), the upstream generator and client. The provenance of the generator and of the schema is in [NOTICE.md](https://github.com/stateforge-labs/herdr-sdk/blob/main/NOTICE.md).

## License

MIT. Owner: stateforge-labs. The license text, including the copyright notice, is in [LICENSE](https://github.com/stateforge-labs/herdr-sdk/blob/main/LICENSE).
