// Role: emits index.ts, the public re-exports of the generated modules plus PROTOCOL and SCHEMA_VERSION.
// Informs HERDR-ADR-0002 and plan section 3.2 (ported from atalaya-bridge 097adfd gen/index.ts inline index text; names from names.ts since phase 1b).
import type { ApiSchema } from './schema.ts';

export function emitIndex(schema: ApiSchema, header: string): string {
  return `${header}
// Each schema namespace is its own module: type names such as PaneInfo, TabInfo
// and WorkspaceInfo are defined DIFFERENTLY in the event and response namespaces,
// so a flat merge would be wrong, not just ambiguous.
export * as params from './params.ts';
export * as results from './results.ts';
export * as errors from './errors.ts';
export * as events from './events.ts';
export { METHODS } from './methods.ts';
export { METHOD_RESULT } from './results.ts';
export type { MethodParams, Subscription } from './params.ts';
export type { ResponseResult, ResultByTag } from './results.ts';
export type { ErrorBody } from './errors.ts';
export type { EventFrame, SubscriptionEventFrame, PushFrame } from './events.ts';
export {
  Method,
  EventKind,
  SubscriptionEventKind,
  SubscriptionType,
  EventMatchKind,
  ResultTag,
  AgentStatus,
  CapabilityClass,
  ServerCapability,
  TOKEN_NAME_PATTERN,
  ENTRY_METHODS,
  PRESET_METHODS,
} from './names.ts';
export { DEFAULT_RESULT } from './defaults.ts';
export { JsonKind, PARAMS_SHAPE } from './shapes.ts';
export type { FieldShape, ParamsShape } from './shapes.ts';
export { CAPABILITY_GATE, LONG_POLL, STREAM_RETURNS } from './overrides.ts';
export type * from './namespaces.ts';
export const PROTOCOL = ${JSON.stringify(schema.protocol)} as const;
export const SCHEMA_VERSION = ${JSON.stringify(schema.schema_version)} as const;
`;
}
