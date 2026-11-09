// Role: the branded values of ./core share one marker: a consumer's Brand from the entry is the SDK's brand, a different name is refused, and ok/err narrow with isOk/isErr.
// Informs HERDR-ADR-0005 (negative type fixtures). Compiled, never run.
import { brand, err, isErr, isOk, ok } from '../../../src/core.ts';
import type { Brand, HcAddress, ParseFailure, Result } from '../../../src/core.ts';

type PaneId = Brand<string, 'PaneId'>;

export const fromBrand: HcAddress = brand<string, 'HcAddress'>('t1');

const plain: string = 't1';
// @ts-expect-error a plain string is not an HcAddress
export const fromPlain: HcAddress = plain;

export const pane: PaneId = brand<string, 'PaneId'>('p1');
// @ts-expect-error a different brand name is not an HcAddress
export const fromPane: HcAddress = pane;

declare const failure: ParseFailure;

export function parsePane(text: string): Result<PaneId, ParseFailure> {
  return text.length > 0 ? ok(brand<string, 'PaneId'>(text)) : err(failure);
}

export function paneOrNull(result: Result<PaneId, ParseFailure>): PaneId | null {
  if (isOk(result)) {
    const value: PaneId = result.value;
    return value;
  }
  if (isErr(result)) {
    const error: ParseFailure = result.error;
    console.log(error);
  }
  return null;
}
