# `@stateforge-labs/herdr-sdk/core`: API reference

This reference is written by hand. The generated references are `methods.md` and `events.md` in this folder.

## Terminals

A terminal is a row of the herdr-core `terminal.list` and `events` payloads. `HcTerminal` is the typed form of the rows that matter to an agent view: a live terminal that reports an agent under a labelled tab. A shell, a finished terminal and a terminal without the tab or workspace label are not an `HcTerminal`.

### `HcTerminal`

| Field | Type | Source in the row |
| --- | --- | --- |
| `address` | `HcAddress` | `address` |
| `tab` | `NonEmptyText` | `labels["herdr.tab"]` |
| `workspace` | `NonEmptyText` | `labels["herdr.space"]` |
| `app` | `NonEmptyText` | `status.app` |
| `status` | `NonEmptyText` | `status.state`, the agent's own state (`working`, `idle`, ...) |
| `pid` | `PositiveCount \| null` | `foreground.pid` |
| `cwd` | `NonEmptyText \| null` | `foreground.cwd`, else the row's `cwd` |
| `title` | `Text \| null` | `title` (an empty title is kept as `""`) |

`HcAddress` is a branded string. The SDK does not know the consumer's own id types: a consumer that has its own pane or tab brand re-parses `terminal.address` with its own parser.

### `parseHcTerminal(row)`

Returns `ok(HcTerminal)` only when all of these hold:

- the row is an object (`not-a-row` otherwise);
- `state` is `live` (any other value gives `empty`);
- `address` is non-empty text;
- `labels["herdr.tab"]` and `labels["herdr.space"]` are non-empty text;
- `status.app` and `status.state` are non-empty text.

Every other row gives `err({ kind: "empty" })`. A pid that is not a positive integer, a foreground that is not an object and a title that is not text are not errors: they give `null`.

### Field parsers

- `parseHcAddress(input)`: non-empty text as an `HcAddress`.
- `parseHcPlacement(labels)`: the tab and workspace of a `labels` object.
- `parseHcReport(status)`: the app and the agent state of a `status` object.
- `parseHcForeground(row)`: the pid and cwd of a row. Never `empty`; `not-a-row` only for a non-object.

### `hcAddressOf(payload)`

The `address` of a payload as an `HcAddress`, or `null` when the payload has none.

### `hcTerminalEqual(a, b)`

`true` when all eight fields of the two terminals are equal (`===`). Use it to detect a change between two folds of the same terminal.

### `parsePositiveCount(input)`

Re-exported from the value types: an integer above zero as a `PositiveCount`, otherwise an `out-of-range`, `not-an-integer` or `not-a-number` failure.

## Constants

- `HcLabel`: `Tab` is `herdr.tab`, `Workspace` is `herdr.space`.
- `HcTerminalField`: the field names of a terminal row (`address`, `labels`, `state`, `status`, `app`, `foreground`, `pid`, `cwd`, `title`). `State` is used both for the row's live state and for the agent's state in `status`, as the wire does.
- `HcTerminalState`: `Live` (`live`) and `Finished` (`finished`), the values of a row's `state`.

## What a terminal row looks like

The `event:created` data recorded from a real herdr-core (`src/core/test-kit/frames.ts`, masked) has these fields: `address`, `argv`, `cols`, `created_ms`, `cwd`, `exit_code`, `finished_ms`, `identity`, `keep`, `labels`, `name`, `notify`, `parent`, `pid`, `reason`, `reported`, `rm`, `rows`, `screen`, `signal`, `state`, `status`, `status_ms`, `template`, `title`, `turn`. A terminal with no agent has `labels: {}` and `status: null`, so it is not an `HcTerminal`. An agent terminal has `labels` with `herdr.tab` and `herdr.space`, and `status` with `app` and `state`.
