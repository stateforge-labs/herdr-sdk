// Role: driftBetween(): compares the committed and the installed schema: protocol, herdr version, four facets by name, changed field shapes and unmapped methods.
// Informs HERDR-ADR-0009 (the report lists added and removed separately) and plan 6; contract in drift/types.ts (DriftBetween).
import { hasMovement, nameDiff } from './name-diff.ts';
import { inventoryOf } from './inventory.ts';
import { unmappedMethods } from './unmapped-methods.ts';
import type { DriftBetween, SchemaInventory } from './types.ts';

export const driftBetween: DriftBetween = (committed, installed) => {
  const copy = inventoryOf(committed.schema, committed.herdrVersion);
  const live = inventoryOf(installed.schema, installed.herdrVersion);
  const methods = nameDiff(copy.methods, live.methods);
  const resultTags = nameDiff(copy.resultTags, live.resultTags);
  const eventKinds = nameDiff(copy.eventKinds, live.eventKinds);
  const subscriptionTypes = nameDiff(copy.subscriptionTypes, live.subscriptionTypes);
  const changedShapes = changedShapesOf(copy, live);
  const unmapped = unmappedMethods(live.methods);
  const drifted = copy.protocol !== live.protocol
    || copy.herdrVersion !== live.herdrVersion
    || [methods, resultTags, eventKinds, subscriptionTypes].some(hasMovement)
    || changedShapes.length > 0
    || unmapped.length > 0;
  return {
    protocol: { committed: copy.protocol, installed: live.protocol },
    herdrVersion: { committed: copy.herdrVersion, installed: live.herdrVersion },
    methods,
    resultTags,
    eventKinds,
    subscriptionTypes,
    changedShapes,
    unmappedMethods: unmapped,
    drifted,
  };
};

// Types present on both sides whose stable field shape differs (added and removed types are reported by the facets).
function changedShapesOf(copy: SchemaInventory, live: SchemaInventory): string[] {
  return Object.keys(copy.fieldShapes)
    .filter((name) => Object.hasOwn(live.fieldShapes, name) && copy.fieldShapes[name] !== live.fieldShapes[name])
    .toSorted();
}
