// Role: CoreRoster: the folded table of terminals from the snapshot, the events and missed.
// Informs HERDR-ADR-0020 (the herdr-core client); ported from the tab-recap hc-core-roster fold, without its lane, session and frame parts.
import { HcEventType, HcKind, HcPatchField, HcTerminalField, HcTerminalState, RosterChange } from './constants.ts';
import { brand, byKind, isFields, isOk } from './kernel.ts';
import type { Count, Fields, KindMap, NonEmptyText } from './kernel.ts';
import { hcAddressOf, hcTerminalEqual, parseHcAddress, parseHcTerminal } from './terminal.ts';
import type { HcAddress, HcTerminal } from './terminal.ts';
import type { HcCoreFeed } from './events.ts';
import { parseHcPayload } from './wire.ts';
import type { HcEvent, HcPayload, HcSnapshot } from './wire.ts';

export type RosterDelta =
  | { readonly kind: typeof RosterChange.Added; readonly terminal: HcTerminal }
  | { readonly kind: typeof RosterChange.Changed; readonly terminal: HcTerminal; readonly before: HcTerminal }
  | { readonly kind: typeof RosterChange.Removed; readonly terminal: HcTerminal };

export interface RosterStep {
  readonly revision: Count;
  readonly seq: Count | null;
  readonly initial: boolean;
  readonly deltas: readonly RosterDelta[];
  readonly unknownType: NonEmptyText | null;
}

type Table = ReadonlyMap<HcAddress, HcTerminal>;
type Rows = Map<HcAddress, HcPayload>;
type Patch = (data: HcPayload) => Fields | null;

const EVENT_TYPES: ReadonlySet<unknown> = new Set<unknown>(Object.values(HcEventType));
const NO_TABLE: Table = new Map();
const ZERO = brand<number, 'Count'>(0);

export function isHcEventType(input: unknown): input is HcEventType {
  return EVENT_TYPES.has(input);
}

function readOf(source: unknown, key: string): unknown {
  return isFields(source) ? source[key] : undefined;
}

function bump(count: Count): Count {
  return brand<number, 'Count'>(count + 1);
}

function rowsOf(terminals: readonly HcPayload[]): Rows {
  const rows: Rows = new Map();
  for (const row of terminals) {
    const address = hcAddressOf(row);
    if (address !== null) {
      rows.set(address, row);
    }
  }
  return rows;
}

function mergeRow(row: HcPayload, patch: Fields): HcPayload | null {
  const parsed = parseHcPayload({ ...row, ...patch });
  return isOk(parsed) ? parsed.value : null;
}

function deltasBetween(before: Table, after: Table): RosterDelta[] {
  const removed = [...before].flatMap(([address, terminal]): RosterDelta[] => (after.has(address) ? [] : [{ kind: RosterChange.Removed, terminal }]));
  const changed = [...after].flatMap(([address, terminal]): RosterDelta[] => {
    const prior = before.get(address);
    if (prior === undefined) {
      return [{ kind: RosterChange.Added, terminal }];
    }
    return hcTerminalEqual(prior, terminal) ? [] : [{ kind: RosterChange.Changed, terminal, before: prior }];
  });
  return [...removed, ...changed];
}

const noPatch: Patch = () => null;

function finishedPatch(data: HcPayload): Fields {
  return {
    [HcPatchField.ExitCode]: readOf(data, HcPatchField.ExitCode),
    [HcPatchField.FinishedMs]: readOf(data, HcPatchField.FinishedMs),
    [HcPatchField.Reason]: readOf(data, HcPatchField.Reason),
    [HcPatchField.Signal]: readOf(data, HcPatchField.Signal),
    [HcPatchField.State]: HcTerminalState.Finished,
    [HcPatchField.Foreground]: null,
  };
}

const PATCH_OF: Readonly<Record<HcEventType, Patch>> = {
  [HcEventType.Created]: noPatch,
  [HcEventType.Restarted]: noPatch,
  [HcEventType.Removed]: noPatch,
  [HcEventType.Foreground]: (data) => ({ [HcPatchField.Foreground]: data }),
  [HcEventType.Labels]: (data) => ({ [HcPatchField.Labels]: readOf(data, HcPatchField.Labels) }),
  [HcEventType.Title]: (data) => ({ [HcPatchField.Title]: readOf(data, HcPatchField.Title) }),
  [HcEventType.Status]: (data) => ({
    [HcPatchField.Status]: readOf(data, HcPatchField.Status),
    [HcPatchField.Reported]: readOf(data, HcPatchField.Reported),
    [HcPatchField.Records]: readOf(data, HcPatchField.Records),
  }),
  [HcEventType.Keep]: (data) => ({ [HcPatchField.Keep]: readOf(data, HcPatchField.Keep) }),
  [HcEventType.Size]: (data) => ({ [HcPatchField.Cols]: readOf(data, HcPatchField.Cols), [HcPatchField.Rows]: readOf(data, HcPatchField.Rows) }),
  [HcEventType.Finished]: finishedPatch,
  [HcEventType.Lost]: finishedPatch,
  [HcEventType.Turn]: noPatch,
  [HcEventType.Doc]: noPatch,
};

function patchOf(type: string): Patch {
  return isHcEventType(type) ? PATCH_OF[type] : noPatch;
}

export class CoreRoster {
  private rows: Rows = new Map();
  private table: Table = NO_TABLE;
  private seeded = false;
  private count: Count = ZERO;
  private last: Count | null = null;
  private readonly cache = new WeakMap<HcPayload, HcTerminal | null>();
  private readonly folders: KindMap<HcCoreFeed, RosterStep> = {
    [HcKind.Heartbeat]: () => this.step(false, [], null),
    [HcKind.Snapshot]: (feed) => this.restore(feed.snapshot),
    [HcKind.Missed]: (feed) => this.restore(feed.snapshot),
    [HcKind.Event]: (feed) => this.fromEvent(feed),
  };

  get revision(): Count {
    return this.count;
  }

  get seq(): Count | null {
    return this.last;
  }

  get terminals(): ReadonlyMap<HcAddress, HcTerminal> {
    return this.table;
  }

  addresses(): readonly HcAddress[] {
    return [...this.rows].flatMap(([address, row]) => (readOf(row, HcTerminalField.State) === HcTerminalState.Live ? [address] : []));
  }

  get(address: HcAddress): HcTerminal | null {
    return this.table.get(address) ?? null;
  }

  load(rows: readonly HcPayload[]): readonly RosterDelta[] {
    return this.install(rowsOf(rows)).deltas;
  }

  loadIfCurrent(since: Count, rows: readonly HcPayload[]): readonly RosterDelta[] | null {
    return since === this.count ? this.load(rows) : null;
  }

  fold(feed: HcCoreFeed): RosterStep {
    return byKind(this.folders, feed, undefined);
  }

  private restore(snapshot: HcSnapshot): RosterStep {
    this.count = bump(this.count);
    const { initial, deltas } = this.install(rowsOf(snapshot.terminals));
    this.last = snapshot.seq;
    return this.step(initial, deltas, null);
  }

  private fromEvent(event: HcEvent): RosterStep {
    this.count = bump(this.count);
    const rows: Rows = new Map(this.rows);
    const unknownType = this.apply(rows, event);
    const { initial, deltas } = this.install(rows);
    this.last = event.seq;
    return this.step(initial, deltas, unknownType);
  }

  private step(initial: boolean, deltas: readonly RosterDelta[], unknownType: NonEmptyText | null): RosterStep {
    return { revision: this.count, seq: this.last, initial, deltas, unknownType };
  }

  private install(rows: Rows): { readonly initial: boolean; readonly deltas: readonly RosterDelta[] } {
    const initial = !this.seeded;
    const before = initial ? NO_TABLE : this.table;
    this.seeded = true;
    this.rows = rows;
    this.table = this.derive();
    return { initial, deltas: deltasBetween(before, this.table) };
  }

  private apply(rows: Rows, event: HcEvent): NonEmptyText | null {
    const named = parseHcAddress(event.terminal);
    const key = isOk(named) ? named.value : hcAddressOf(event.data);
    if (key !== null) {
      if (event.type === HcEventType.Created || event.type === HcEventType.Restarted) {
        rows.set(key, event.data);
      } else if (event.type === HcEventType.Removed) {
        rows.delete(key);
      } else {
        const current = rows.get(key);
        const patch = patchOf(event.type)(event.data);
        const merged = current !== undefined && patch !== null ? mergeRow(current, patch) : null;
        if (merged !== null) {
          rows.set(key, merged);
        }
      }
    }
    return isHcEventType(event.type) ? null : event.type;
  }

  private derive(): Table {
    const table = new Map<HcAddress, HcTerminal>();
    for (const [address, row] of this.rows) {
      const terminal = this.terminalOf(row);
      if (terminal !== null) {
        table.set(address, terminal);
      }
    }
    return table;
  }

  private terminalOf(row: HcPayload): HcTerminal | null {
    const cached = this.cache.get(row);
    if (cached !== undefined) {
      return cached;
    }
    const parsed = parseHcTerminal(row);
    const terminal = isOk(parsed) ? parsed.value : null;
    this.cache.set(row, terminal);
    return terminal;
  }
}
