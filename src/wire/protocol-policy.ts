// Role: decides whether a server's protocol number is acceptable: exact match by default, or a minimum when the policy says so.
// Informs HERDR-ADR-0009 (protocol-tied versioning) and plan 3.1 (protocolPolicy); ported from hub infra/herdr/protocol-policy.ts (policy as a value, not a boolean).
import { ProtocolPolicy } from '../constants.ts';
import { PROTOCOL } from '../generated/index.ts';

export function isSupportedProtocol(
  actual: number,
  policy: ProtocolPolicy = ProtocolPolicy.Exact,
  expected: number = PROTOCOL,
): boolean {
  switch (policy) {
    case ProtocolPolicy.Exact:
      return actual === expected;
    case ProtocolPolicy.Minimum:
      return actual >= expected;
  }
}
