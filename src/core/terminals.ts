// Role: CoreTerminals, the typed reads of herdr-core: terminal.list, terminal.get and terminal.read; parseHcListing and parseHcScreen check their replies; lastLines trims a screen to its last lines.
// Informs HERDR-ADR-0020 (the herdr-core client); ported from tab-recap's hc-core-fleet readScreen and parseHcListed.
// terminal.read line semantics (from `hc read --help` and the hc binary): `lines` is the count of history lines above the screen; 0 is the visible screen only, not "all". `how` is screen, history or stitched. `complete` is false when part of what was asked may be missing. `why` says why only the screen was read: working, blocked or error.
import { CoreText, HC_CALL_TIMEOUT, HC_GET_METHOD, HC_LINE_SEPARATOR, HC_LIST_METHOD, HC_READ_METHOD, HC_RPC_NOT_FOUND, HcField, HcReadField, OutcomeKind, ParseFailureKind, UnknownWhy } from './constants.ts';
import { isUnknown, unknown } from './errors.ts';
import type { ParseFailure, Unknown } from './errors.ts';
import { err, isBoolean, isErr, isFields, isOk, must, ok, parseCount, parseText } from './kernel.ts';
import type { Count, Duration, Result, Text } from './kernel.ts';
import { CoreLink } from './link.ts';
import type { HcCallResult } from './link.ts';
import type { HcAddress } from './terminal.ts';
import { parseHcParams, parseHcPayload } from './wire.ts';
import type { HcPayload } from './wire.ts';

export interface HcListing {
  readonly kind: typeof OutcomeKind.Answer;
  readonly terminals: readonly HcPayload[];
  readonly hiddenFinished: Count | null;
}

export interface HcFetched {
  readonly kind: typeof OutcomeKind.Answer;
  readonly terminal: HcPayload;
}

export interface HcScreen {
  readonly kind: typeof OutcomeKind.Answer;
  readonly text: Text;
  readonly complete: boolean;
  readonly how: Text;
  readonly why: Text | null;
}

export interface HcReadOptions {
  readonly history?: Count;
}

const ZERO = must(parseCount(0));
const NO_PARAMS = must(parseHcParams({}));

function fieldOf(source: unknown, key: string): unknown {
  return isFields(source) ? source[key] : undefined;
}

function orNull<T>(parsed: Result<T, ParseFailure>): T | null {
  return isOk(parsed) ? parsed.value : null;
}

export function parseHcListing(input: unknown): Result<HcListing, ParseFailure> {
  const rows = fieldOf(input, HcField.Terminals);
  if (!Array.isArray(rows)) {
    return err({ kind: ParseFailureKind.NotARow });
  }
  const terminals = rows.flatMap((row): HcPayload[] => {
    const payload = parseHcPayload(row);
    return isOk(payload) ? [payload.value] : [];
  });
  return ok({ kind: OutcomeKind.Answer, terminals, hiddenFinished: orNull(parseCount(fieldOf(input, HcReadField.HiddenFinished))) });
}

export function parseHcScreen(input: unknown): Result<HcScreen, ParseFailure> {
  if (!isFields(input)) {
    return err({ kind: ParseFailureKind.NotARow });
  }
  const text = parseText(input[HcReadField.Text]);
  const how = parseText(input[HcReadField.How]);
  if (isErr(text) || isErr(how)) {
    return err({ kind: ParseFailureKind.NotAString });
  }
  const complete = input[HcReadField.Complete];
  if (!isBoolean(complete)) {
    return err({ kind: ParseFailureKind.NotABoolean });
  }
  return ok({ kind: OutcomeKind.Answer, text: text.value, complete, how: how.value, why: orNull(parseText(input[HcReadField.Why])) });
}

export function lastLines(text: Text, count: Count): { readonly text: Text; readonly truncated: boolean } {
  const all = text.split(HC_LINE_SEPARATOR);
  const kept = all.slice(Math.max(0, all.length - count)).join(HC_LINE_SEPARATOR);
  return { text: must(parseText(kept)), truncated: all.length > count };
}

function missing(answer: Unknown): Unknown {
  return answer.why.why === UnknownWhy.Failed && answer.why.code === HC_RPC_NOT_FOUND
    ? unknown({ why: UnknownWhy.NotFound, what: answer.why.detail })
    : answer;
}

export class CoreTerminals {
  private readonly link: CoreLink;
  private readonly timeout: Duration;

  constructor(link: CoreLink, timeout: Duration = HC_CALL_TIMEOUT) {
    this.link = link;
    this.timeout = timeout;
  }

  async list(): Promise<HcListing | Unknown> {
    const answer = await this.link.call(HC_LIST_METHOD, NO_PARAMS, this.timeout);
    if (isUnknown(answer)) {
      return answer;
    }
    const listing = parseHcListing(answer.value);
    return isOk(listing) ? listing.value : unknown({ why: UnknownWhy.Unreadable, detail: CoreText.OddListing });
  }

  async get(address: HcAddress): Promise<HcFetched | Unknown> {
    const answer = await this.link.call(HC_GET_METHOD, must(parseHcParams({ [HcField.Terminal]: address })), this.timeout);
    if (isUnknown(answer)) {
      return missing(answer);
    }
    return { kind: OutcomeKind.Answer, terminal: answer.value };
  }

  async read(address: HcAddress, options: HcReadOptions = {}): Promise<HcScreen | Unknown> {
    const params = must(parseHcParams({ [HcReadField.Terminal]: address, [HcReadField.Lines]: options.history ?? ZERO }));
    const answer = await this.link.call(HC_READ_METHOD, params, this.timeout);
    if (isUnknown(answer)) {
      return missing(answer);
    }
    const screen = parseHcScreen(answer.value);
    return isOk(screen) ? screen.value : unknown({ why: UnknownWhy.Unreadable, detail: CoreText.OddScreen });
  }
}
