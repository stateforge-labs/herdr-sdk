// Role: inventoryOf(): the inventory of one schema (stub until lane P5c).
// Informs HERDR-ADR-0009 and plan 6; contract in drift/types.ts (InventoryOf).
import { Lane } from '../constants.ts';
import { notImplemented } from '../not-implemented.ts';
import type { InventoryOf } from './types.ts';

export const inventoryOf: InventoryOf = () => notImplemented('inventoryOf', Lane.P5c);
