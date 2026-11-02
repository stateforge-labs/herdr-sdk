// Role: bearerGuard(): checks an HTTP Authorization header (`Bearer <token>`) against the expected token in constant time.
// Informs HERDR-ADR-0010 and plan 7 (lane P6c); contract in mcp/types.ts (BearerGuard). Never logs the token.
import { timingSafeEqual } from 'node:crypto';
import { McpAuth, TEXT_ENCODING } from '../constants.ts';
import type { BearerGuard } from './types.ts';

// The token after `Bearer `, or undefined for a missing header, another scheme, or an empty token.
const presentedToken = (authorization: string | undefined): string | undefined => {
  if (authorization === undefined) return undefined;
  const prefix = McpAuth.Scheme + McpAuth.SchemeSeparator;
  if (!authorization.startsWith(prefix)) return undefined;
  const token = authorization.slice(prefix.length);
  return token.length > 0 ? token : undefined;
};

// timingSafeEqual throws on unequal lengths, so the lengths are compared first.
const tokensMatch = (expected: string, presented: string): boolean => {
  const a = Buffer.from(expected, TEXT_ENCODING);
  const b = Buffer.from(presented, TEXT_ENCODING);
  return a.length === b.length && timingSafeEqual(a, b);
};

export const bearerGuard: BearerGuard = (expectedToken) => (authorization) => {
  const presented = presentedToken(authorization);
  return presented !== undefined && tokensMatch(expectedToken, presented);
};
