// Role: the standalone method constants (generated names/method.ts) are the same literals as the Method object members, and the entry lists type as before.
// Informs HERDR-ADR-0017 (contract tests), HERDR-ADR-0002 and the 2026-11-02 build amendment (library code imports MethodX, not the Method object). Compiled, never run.
import { ENTRY_METHODS } from '../../../src/generated/entry-methods.ts';
import { Method } from '../../../src/generated/index.ts';
import type { MethodName } from '../../../src/generated/method-table.ts';
import { MethodEventsSubscribe, MethodPing } from '../../../src/generated/names/method.ts';
import { READ_ONLY_METHODS } from '../../../src/generated/entries/read-only.ts';

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const pingConstantIsMember: Equal<typeof MethodPing, typeof Method.Ping> = true;
export const subscribeConstantIsMember: Equal<typeof MethodEventsSubscribe, typeof Method.EventsSubscribe> = true;
export const methodUnionIsTheTable: Equal<Method, MethodName> = true;
export const readOnlyListIsEntry: Equal<(typeof READ_ONLY_METHODS)[number], (typeof ENTRY_METHODS.readOnly)[number]> = true;
