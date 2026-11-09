// Role: the typed terminal row of the herdr-core wire: HcTerminal and its parsers.
// Informs HERDR-ADR-0020 (the herdr-core client); ported from tab-recap's hc-terminal.ts. A row is a live terminal that reports an agent under a labelled tab.
import { HcLabel, HcTerminalField, HcTerminalState, ParseFailureKind } from './constants.ts';
import type { ParseFailure } from './errors.ts';
import { brand, err, isFields, isOk, ok, parseNonEmptyText, parsePositiveCount, parseText } from './kernel.ts';
import type { Brand, Fields, NonEmptyText, PositiveCount, Result, Text } from './kernel.ts';
import type { HcPayload } from './wire.ts';

export type HcAddress = Brand<string, 'HcAddress'>;

export interface HcPlacement {
  readonly tab: NonEmptyText;
  readonly workspace: NonEmptyText;
}

export interface HcReport {
  readonly app: NonEmptyText;
  readonly status: NonEmptyText;
}

export interface HcForeground {
  readonly pid: PositiveCount | null;
  readonly cwd: NonEmptyText | null;
}

export interface HcTerminal extends HcPlacement, HcReport, HcForeground {
  readonly address: HcAddress;
  readonly title: Text | null;
}

function fieldOf(source: unknown, key: string): unknown {
  return isFields(source) ? source[key] : undefined;
}

function orNull<T>(parsed: Result<T, ParseFailure>): T | null {
  return isOk(parsed) ? parsed.value : null;
}

export function parseHcAddress(input: unknown): Result<HcAddress, ParseFailure> {
  const text = parseNonEmptyText(input);
  return isOk(text) ? ok(brand<string, 'HcAddress'>(text.value)) : text;
}

export function parseHcPlacement(labels: unknown): Result<HcPlacement, ParseFailure> {
  const tab = parseNonEmptyText(fieldOf(labels, HcLabel.Tab));
  const workspace = parseNonEmptyText(fieldOf(labels, HcLabel.Workspace));
  return isOk(tab) && isOk(workspace) ? ok({ tab: tab.value, workspace: workspace.value }) : err({ kind: ParseFailureKind.Empty });
}

export function parseHcReport(status: unknown): Result<HcReport, ParseFailure> {
  const app = parseNonEmptyText(fieldOf(status, HcTerminalField.App));
  const state = parseNonEmptyText(fieldOf(status, HcTerminalField.State));
  return isOk(app) && isOk(state) ? ok({ app: app.value, status: state.value }) : err({ kind: ParseFailureKind.Empty });
}

function foregroundOf(row: Fields): HcForeground {
  const foreground = row[HcTerminalField.Foreground];
  return {
    pid: orNull(parsePositiveCount(fieldOf(foreground, HcTerminalField.Pid))),
    cwd: orNull(parseNonEmptyText(fieldOf(foreground, HcTerminalField.Cwd))) ?? orNull(parseNonEmptyText(row[HcTerminalField.Cwd])),
  };
}

export function parseHcForeground(row: unknown): Result<HcForeground, ParseFailure> {
  return isFields(row) ? ok(foregroundOf(row)) : err({ kind: ParseFailureKind.NotARow });
}

export function parseHcTerminal(row: unknown): Result<HcTerminal, ParseFailure> {
  if (!isFields(row)) {
    return err({ kind: ParseFailureKind.NotARow });
  }
  const address = parseHcAddress(row[HcTerminalField.Address]);
  const placement = parseHcPlacement(row[HcTerminalField.Labels]);
  const report = parseHcReport(row[HcTerminalField.Status]);
  if (row[HcTerminalField.State] !== HcTerminalState.Live || !isOk(address) || !isOk(placement) || !isOk(report)) {
    return err({ kind: ParseFailureKind.Empty });
  }
  return ok({
    address: address.value,
    ...placement.value,
    ...report.value,
    ...foregroundOf(row),
    title: orNull(parseText(row[HcTerminalField.Title])),
  });
}

export function hcAddressOf(row: HcPayload): HcAddress | null {
  return orNull(parseHcAddress(fieldOf(row, HcTerminalField.Address)));
}

export function hcTerminalEqual(a: HcTerminal, b: HcTerminal): boolean {
  return a.address === b.address && a.tab === b.tab && a.workspace === b.workspace && a.app === b.app && a.status === b.status && a.pid === b.pid && a.cwd === b.cwd && a.title === b.title;
}
