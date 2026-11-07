// Role: the one place a method is sent for a client: the allow-list check, then the long-poll timeout, then the core call.
// Informs HERDR-ADR-0005 (runtime allow-list before sending), HERDR-ADR-0007 and plan 3.6 (long-poll timeout); contract in client/types.ts (Invoke).
import { ErrorText } from '../../constants.ts';
import { LONG_POLL, type Method } from '../../generated/index.ts';
import { HerdrTransportError } from '../../wire/errors.ts';
import type { ParamsOf } from '../../wire/types.ts';
import { assertLongPollBounds as defaultAssertBounds } from '../long-poll/bounds.ts';
import { requestTimeoutMs as defaultRequestTimeoutMs } from '../long-poll/timeout.ts';
import type { AssertLongPollBounds, RequestTimeoutMs } from '../long-poll/types.ts';
import type { CallOptions, CoreClient, Invoke } from '../types.ts';

/** The P4a helpers a long-poll call needs; tests pass stubs. */
export interface InvokeDeps {
  readonly requestTimeoutMs: RequestTimeoutMs;
  readonly assertLongPollBounds: AssertLongPollBounds;
}

const DEFAULT_DEPS: InvokeDeps = {
  requestTimeoutMs: defaultRequestTimeoutMs,
  assertLongPollBounds: defaultAssertBounds,
};

export function createInvoke(core: CoreClient, allowed: ReadonlySet<Method>, deps: InvokeDeps = DEFAULT_DEPS): Invoke {
  return async function invoke(method, params, options = {}) {
    assertAllowed(method, allowed);
    // The generated tree and the generic call() both pass params typed by the method name; the server checks the shape.
    const wire = params as ParamsOf<Method>;
    if (!isLongPoll(method)) {
      return core.call(method, wire, options);
    }
    deps.assertLongPollBounds(method, params);
    const timeoutMs = deps.requestTimeoutMs(method, params, core.transport.timeoutMs);
    return core.call(method, wire, withTimeout(options, timeoutMs));
  };
}

/** Throws before anything is sent when the method is not in the entry's allow-list. */
export function assertAllowed(method: Method, allowed: ReadonlySet<Method>): void {
  if (!allowed.has(method)) {
    throw new HerdrTransportError(ErrorText.NotAllowed(method));
  }
}

function isLongPoll(method: Method): boolean {
  return Object.hasOwn(LONG_POLL, method);
}

// The computed long-poll timeout is a default: a timeoutMs the caller set on this call wins (connect-core.callRpcOptions says the same).
function withTimeout(options: CallOptions, timeoutMs: number | undefined): CallOptions {
  return timeoutMs === undefined || options.timeoutMs !== undefined ? options : { ...options, timeoutMs };
}
