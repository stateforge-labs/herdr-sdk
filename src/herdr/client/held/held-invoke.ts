// Role: the Invoke of one held connection: applies the capability gate before sending, refuses calls after the connection ended, and sends one request at a time.
// Informs HERDR-ADR-0016 (W1: one request per connection at a time, no pipelining) and plan 3.6 (held calls are serialised; per-call timeout falls back to the client's); contract Invoke in client/types.ts.
import { HeldText } from '../../../constants.ts';
import type { Method } from '../../generated/index.ts';
import type { ParamsOf } from '../../wire/types.ts';
import { HerdrTransportError } from '../../wire/errors.ts';
import type { DedicatedConnection } from '../../wire/types.ts';
import { assertCapability } from '../capability-gate.ts';
import type { CallOptions, ClientCapabilities, Invoke } from '../types.ts';
import { untilAborted } from './until-aborted.ts';

export interface HeldInvokeDeps {
  readonly capabilities: ClientCapabilities;
  readonly timeoutMs: number;
}

export function createHeldInvoke(conn: DedicatedConnection, deps: HeldInvokeDeps, isEnded: () => boolean): Invoke {
  // Every call waits for the previous one, so a second request never reaches the connection while one is pending.
  let previous: Promise<unknown> = Promise.resolve();
  return async function invokeHeld(method: Method, params: unknown, options?: CallOptions): Promise<unknown> {
    assertCapability(method, deps.capabilities);
    const signal = options?.signal;
    const send = async (): Promise<unknown> => {
      // A call aborted while it was queued is never sent.
      if (signal?.aborted === true) {
        throw signal.reason;
      }
      if (isEnded()) {
        throw new HerdrTransportError(HeldText.Ended(method));
      }
      // Invoke erases the params type (client/types.ts); the generated namespaces type them at the leaf that calls this.
      return conn.request(method, params as ParamsOf<Method>, {
        timeoutMs: options?.timeoutMs ?? deps.timeoutMs,
        signal,
      });
    };
    const run = previous.then(send);
    previous = run.catch(() => undefined);
    // The caller hears its own abort at once, even while the call waits for an earlier one.
    return untilAborted(run, signal);
  };
}
