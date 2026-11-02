// Role: the pong the fake answers ping with, and the capabilities it advertises by default.
// Informs HERDR-ADR-0016 (fake fact F1: ping answers a pong with protocol and version) and plan 5 (capabilities option); the default capability set is the fake's own choice.
import { DEFAULT_CAPABILITIES, Fake, WireField } from '../constants.ts';
import { ResultTag } from '../generated/index.ts';
import type { ServerCapabilities } from '../generated/results.ts';

// What the pong says: the protocol, the fake version and, when given, the capabilities (null leaves the field out).
export interface PongSettings {
  readonly protocol: number;
  readonly capabilities: ServerCapabilities | null;
}

// The capabilities option as the pong uses it: undefined means the default set.
export function advertisedCapabilities(option: ServerCapabilities | null | undefined): ServerCapabilities | null {
  return option === undefined ? DEFAULT_CAPABILITIES : option;
}

export function pongBody(settings: PongSettings): Record<string, unknown> {
  const body: Record<string, unknown> = {
    [WireField.Type]: ResultTag.Pong,
    [WireField.Protocol]: settings.protocol,
    [WireField.Version]: Fake.Version,
  };
  if (settings.capabilities !== null) {
    body[WireField.Capabilities] = settings.capabilities;
  }
  return body;
}
