// Role: a CoreClient made of plain objects: call() records what it was asked and answers without a socket; close() aborts transport.closed.
// Informs HERDR-ADR-0008 (tests use fakes only, no socket) and plan 5; test helper for slice P2b tests.
import type { CallOptions, ClientCapabilities, CoreClient, ServerInfo } from '../../../../../src/herdr/client/types.ts';
import type { Method } from '../../../../../src/herdr/generated/index.ts';
import type { ParamsOf, ResultOf } from '../../../../../src/herdr/wire/types.ts';

export interface CallRecord {
  readonly method: Method;
  readonly params: unknown;
  readonly options: CallOptions;
}

export interface StubCore {
  readonly core: CoreClient;
  readonly calls: CallRecord[];
  readonly controller: AbortController;
}

export const STUB_TIMEOUT_MS = 4_321;

export function stubCore(capabilities: ClientCapabilities = {}): StubCore {
  const calls: CallRecord[] = [];
  const controller = new AbortController();
  const serverInfo: ServerInfo = { protocol: 22, version: 'stub' };
  const core: CoreClient = {
    capabilities,
    serverInfo,
    transport: {
      socketPath: '/stub/herdr.sock',
      timeoutMs: STUB_TIMEOUT_MS,
      closed: controller.signal,
    },
    async call<M extends Method>(method: M, params: ParamsOf<M>, options: CallOptions = {}): Promise<ResultOf<M>> {
      calls.push({ method, params, options });
      // A test answers with an empty object: the tests check what was sent, not the result shape.
      return {} as ResultOf<M>;
    },
    close(): void {
      controller.abort();
    },
  };
  return { core, calls, controller };
}
