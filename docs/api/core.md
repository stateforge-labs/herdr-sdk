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

## Reading a terminal

`CoreTerminals` makes the three herdr-core reads typed. Build it on a `CoreLink`; the optional second argument is the per-call timeout (`HC_CALL_TIMEOUT` by default). Each method settles as an answer or as an `Unknown`; none throws.

| Method | Core method | Core params | Answer |
| --- | --- | --- | --- |
| `list()` | `terminal.list` | none | `HcListing` |
| `get(address)` | `terminal.get` | `terminal` | `HcFetched` |
| `read(address, { history })` | `terminal.read` | `terminal`, `lines` | `HcScreen` |

### `CoreTerminals`

- `list()`: `terminals` are the object rows as `HcPayload`, so `CoreRoster.load(listing.terminals)` takes them directly; `hiddenFinished` is the core's `hidden_finished` count, or `null`.
- `get(address)`: `terminal` is the row the core answers with.
- `read(address, options)`: `options.history` is the `Count` of history lines to read above the screen; without it the call sends `lines: 0`.

### `terminal.read` line semantics

- `lines` is the number of history lines above the screen. `0` is the visible screen only. It is not "all of the output": to get the output of a screen, read `0`, and to get more, pass the history count.
- `text` is the text read, lines joined by `\n`.
- `how` says how the text was got: `screen` (the screen only), `history`, or `stitched` (a full-screen app read by scrolling it). `HcReadHow` lists the three known values; another value passes through as text.
- `complete` is `false` when part of what was asked may be missing.
- `why` says why only the screen was read: `working`, `blocked` or `error` (`HcReadWhy`), or `null`. Another value passes through as text.

### `HcListing`, `HcFetched`, `HcScreen`, `HcReadOptions`

- `HcListing`: `{ kind: 'answer', terminals: HcPayload[], hiddenFinished: Count | null }`.
- `HcFetched`: `{ kind: 'answer', terminal: HcPayload }`.
- `HcScreen`: `{ kind: 'answer', text: Text, complete: boolean, how: Text, why: Text | null }`.
- `HcReadOptions`: `{ history?: Count }`, the history lines above the screen.

### `parseHcListing(input)`

Returns `ok(HcListing)` when the reply has a `terminals` array (`not-a-row` otherwise). A row that is not an object is dropped, and a `hidden_finished` that is not a count gives `null`.

### `parseHcScreen(input)`

Strict. Returns `ok(HcScreen)` only when `text` and `how` are text (`not-a-string` otherwise) and `complete` is a boolean (`not-a-boolean` otherwise). `why` is optional: text, or `null` for anything else.

### `lastLines(text, count)`

Keeps the last `count` lines of `text` (split on `\n`) and returns `{ text, truncated }`. `truncated` is `true` when a line was dropped. `count` `0` gives empty text. A trailing newline is a final empty line, so `"a\nb\n"` with count 2 gives `"b\n"`. Use it to trim a screen to the lines a view shows.

### Failures

| `Unknown` | When |
| --- | --- |
| `timeout` | the core did not reply within the timeout |
| `unreachable` | the socket is down, dropped or closed; the link reconnects by backoff |
| `unreadable` | the reply has the wrong shape (`OddListing` or `OddScreen`), or the hello reply names another generation |
| `not-found` | `terminal.get` or `terminal.read` faults with `-32000` (`HC_RPC_NOT_FOUND`); `what` is the core's message |
| `failed` | any other fault: `code` and `detail` are the core's |

## Constants

- `HcLabel`: `Tab` is `herdr.tab`, `Workspace` is `herdr.space`.
- `HcTerminalField`: the field names of a terminal row (`address`, `labels`, `state`, `status`, `app`, `foreground`, `pid`, `cwd`, `title`). `State` is used both for the row's live state and for the agent's state in `status`, as the wire does.
- `HcTerminalState`: `Live` (`live`) and `Finished` (`finished`), the values of a row's `state`.
- `HcReadField`: the fields of a `terminal.read` reply and its params (`terminal`, `lines`, `text`, `complete`, `how`, `why`) and the `hidden_finished` of `terminal.list`.
- `HcReadHow`: `Screen`, `History` and `Stitched`, the values of `how`. `HcReadWhy`: `Working`, `Blocked` and `Error`, the values of `why`.
- `HC_RPC_NOT_FOUND`: `-32000`, the JSON-RPC code of a row the core does not hold.

## What a terminal row looks like

The `event:created` data recorded from a real herdr-core (`src/core/test-kit/frames.ts`, masked) has these fields: `address`, `argv`, `cols`, `created_ms`, `cwd`, `exit_code`, `finished_ms`, `identity`, `keep`, `labels`, `name`, `notify`, `parent`, `pid`, `reason`, `reported`, `rm`, `rows`, `screen`, `signal`, `state`, `status`, `status_ms`, `template`, `title`, `turn`. A terminal with no agent has `labels: {}` and `status: null`, so it is not an `HcTerminal`. An agent terminal has `labels` with `herdr.tab` and `herdr.space`, and `status` with `app` and `state`.

## The roster

`CoreRoster` folds the core feed (`events.feed` from `CoreEvents`) into a table of `HcTerminal`. Each fold returns a `RosterStep` with the typed deltas it caused, so a view redraws only what changed.

```ts
const roster = new CoreRoster();
for await (const feed of events.feed) {
  const step = roster.fold(feed);
  for (const delta of step.deltas) {
    // delta.kind is RosterChange.Added, Changed or Removed
  }
}
```

The roster needs no timer and does not dedupe on `seq`: each snapshot and missed feed replaces the rows it holds, and each event patches or adds one row.

### `CoreRoster`

| Member | Meaning |
| --- | --- |
| `fold(feed)` | Applies one `HcCoreFeed` (snapshot, event, heartbeat or missed) and returns a `RosterStep`. |
| `terminals` | The table, a `ReadonlyMap<HcAddress, HcTerminal>` of the agent terminals. |
| `get(address)` | The `HcTerminal` at an address, or `null`. |
| `addresses()` | Every live terminal address, shells included. A shell is not in `terminals`. |
| `revision` | A `Count` that rises on each snapshot, missed or event, and not on a heartbeat. |
| `seq` | The `seq` of the last snapshot, missed or event, or `null` before the first. A heartbeat does not move it. |
| `load(rows)` | Seeds or replaces the table from rows without bumping `revision`, and returns the deltas. |
| `loadIfCurrent(since, rows)` | Calls `load` only while `revision` is still `since`, else returns `null`. Use it to apply a read that raced a feed. |

A heartbeat fold returns no deltas. A snapshot or missed fold diffs the whole table: removed first, then changed, then added, each in table order. The first fold that seeds the table has `initial: true`.

### `RosterStep`

| Field | Type | Meaning |
| --- | --- | --- |
| `revision` | `Count` | The roster revision after this fold. |
| `seq` | `Count \| null` | The feed's `seq` after this fold. |
| `initial` | `boolean` | True on the fold that seeds an empty roster. |
| `deltas` | `readonly RosterDelta[]` | What the fold changed, in the order above. |
| `unknownType` | `NonEmptyText \| null` | The event type when it is not an `HcEventType`, so a newer core can be noticed; the row is not changed. |

### `RosterDelta`

A union of three shapes, discriminated by `kind`:

- `{ kind: 'added', terminal }` for a terminal that joined the table.
- `{ kind: 'changed', terminal, before }` for a terminal whose `HcTerminal` value changed; `before` is the value it replaced.
- `{ kind: 'removed', terminal }` for a terminal that left the table, with its last value.

### `HcEventType`

The core's terminal event types: `Created`, `Restarted`, `Removed`, `Foreground`, `Labels`, `Title`, `Status`, `Keep`, `Size`, `Finished`, `Lost`, `Turn` and `Doc`, as their wire strings (`created`, `restarted`, ...). `isHcEventType(input)` narrows an unknown string to one of them.

### How each event type changes a row

| Event type | Effect on the row | Delta |
| --- | --- | --- |
| `created` | Adds the row from the event data. | `added` |
| `restarted` | Replaces the row with the event data. | `changed` |
| `removed` | Deletes the row. | `removed` |
| `foreground` | Sets `foreground` to the event data (`cwd`, `pid`, ...). | `changed` |
| `labels` | Sets `labels`, which can move the terminal to another tab or workspace. | `changed` |
| `title` | Sets `title`. | `changed` |
| `status` | Sets `status`, `reported` and `records`. A `status` of `null` makes the terminal not an `HcTerminal`. | `changed`, or `removed` |
| `keep` | Sets `keep`. | `changed` only if the terminal value changed |
| `size` | Sets `cols` and `rows`. | `changed` only if the terminal value changed |
| `finished` | Sets `exit_code`, `finished_ms`, `reason`, `signal`, `state` to `finished`, and clears `foreground`. | `removed` |
| `lost` | The same patch as `finished`. | `removed` |
| `turn` | No row change. | none |
| `doc` | No row change. | none |

An event for an address the table never held changes nothing. The `terminal` of an event is used as its address; when it is `null`, the event data's `address` is used.

### `HcPatchField`

The field names a patch writes into a row: `Foreground`, `Labels`, `Title`, `Status`, `Reported`, `Records`, `Keep`, `Cols`, `Rows`, `ExitCode`, `FinishedMs`, `Reason`, `Signal` and `State`, as their wire names.

### `RosterChange`

The three delta kinds: `Added` (`added`), `Changed` (`changed`) and `Removed` (`removed`).
