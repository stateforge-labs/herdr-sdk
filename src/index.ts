// Role: the package entry (".", minimal in 2a): connect(), the client types, the four wire errors, the policy and outcome values, and the onCall types.
// Informs plan 3.3 (connect and its options), plan 3.1 (errors) and HERDR-ADR-0003 (entry points); the full entry set arrives with 2b and the pack work (HERDR-ADR-0012).
export { CallOutcome, ProtocolPolicy } from './constants.ts';
export { PROTOCOL } from './generated/index.ts';
export { connect } from './client/connect.ts';
export type { CallOptions, Client, ClientCapabilities, ConnectOptions, ServerInfo } from './client/types.ts';
export { HerdrError, HerdrTransportError, ProtocolMismatchError, UnsupportedByServerError } from './wire/errors.ts';
export type { CallEvent, OnCall } from './wire/call-hook.ts';
