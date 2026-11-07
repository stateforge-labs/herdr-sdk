// Role: the /schema entry: the method table and parameter shapes of the generated API, read as data by tools outside the SDK.
// Each export is named straight from its generated module, so a bundler keeps only what a consumer imports. Nothing else imports this entry.
export { METHODS } from './generated/method-table.ts';
export { ENTRY_METHODS } from './generated/entry-methods.ts';
export { JsonKind, PARAMS_SHAPE } from './generated/test-data/shapes.ts';
export type { FieldShape, ParamsShape } from './generated/test-data/shapes.ts';
export { CapabilityClass } from './generated/names/capability-class.ts';
