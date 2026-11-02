// Role: the answers the fake gives without a test script: the pong for ping and the empty schema result for api.schema.
// Informs HERDR-ADR-0016 (F1: ping answers a pong; W4: api.schema over the socket answers {}) and plan 5; test-kit only.
// Why no other default: test/wire/fake.test.ts (P2a, read-only) expects an unscripted method to get unknown_method (F6), so unscripted methods get no default answer.
import { EMPTY_SCHEMA_RESULT, FakeMethod } from '../constants.ts';
import { Method } from '../generated/index.ts';
import { pongBody, type PongSettings } from './fake-pong.ts';

// The default result of a method, or undefined when the fake has no default for it.
export function defaultResultOf(method: string, pong: PongSettings): unknown {
  if (method === Method.Ping) {
    return pongBody(pong);
  }
  if (method === FakeMethod.ApiSchema) {
    return EMPTY_SCHEMA_RESULT;
  }
  return undefined;
}
