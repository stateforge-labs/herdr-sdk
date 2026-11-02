// Role: connectCore(): finds the socket, checks it is a socket, pings once, applies the protocol policy and returns the CoreClient that gates methods by capability.
// Informs plan 3.3 (connect steps and options), plan 3.1 (capabilities from pong), HERDR-ADR-0004 (Promise core) and HERDR-ADR-0016 (P1: never spawns herdr); ports the hub checkProtocol and request.
import { ErrorText, ProtocolPolicy, Timeout } from '../constants.ts';
import { Method, PROTOCOL } from '../generated/index.ts';
import type { Result_pong } from '../generated/results.ts';
import type { ParamsOf, ResultOf } from '../wire/typed.ts';
import { HerdrTransportError, ProtocolMismatchError } from '../wire/errors.ts';
import { isSupportedProtocol } from '../wire/protocol-policy.ts';
import { rpc, type RpcOptions } from '../wire/rpc.ts';
import { assertSocketExists, resolveSocketPath } from '../wire/socket-path.ts';
import { assertCapability } from './capability-gate.ts';
import type {
  CallOptions,
  ClientCapabilities,
  ClientTransport,
  ConnectCore,
  ConnectOptions,
  CoreClient,
  ServerInfo,
} from './types.ts';

export const connectCore: ConnectCore = async function connectCore(options: ConnectOptions = {}): Promise<CoreClient> {
  const socketPath = resolveSocketPath({ socketPath: options.socketPath, env: options.env });
  assertSocketExists(socketPath);
  const rpcOptions = requestOptions(options, socketPath);
  const pong = await rpc(rpcOptions, Method.Ping, {});
  checkProtocol(pong, options.protocolPolicy ?? ProtocolPolicy.Exact);
  return createClient(rpcOptions, pong, options);
};

function requestOptions(options: ConnectOptions, socketPath: string): RpcOptions & { readonly timeoutMs: number } {
  return {
    socketPath,
    timeoutMs: options.timeoutMs ?? Timeout.DefaultMs,
    onCall: options.onCall,
  };
}

function checkProtocol(pong: Result_pong, policy: ProtocolPolicy): void {
  if (!isSupportedProtocol(pong.protocol, policy)) {
    throw new ProtocolMismatchError(PROTOCOL, pong.protocol);
  }
}

// The capabilities and server facts are fixed at connect time; a closed client refuses every call without contacting herdr
// and aborts transport.closed so the streams P2b composes end with it (contract ClientBase.close).
function createClient(
  rpcOptions: RpcOptions & { readonly timeoutMs: number },
  pong: Result_pong,
  options: ConnectOptions,
): CoreClient {
  const capabilities: ClientCapabilities = Object.freeze({ ...(pong.capabilities ?? {}) });
  const serverInfo: ServerInfo = Object.freeze({ protocol: pong.protocol, version: pong.version });
  const closer = new AbortController();
  const transport: ClientTransport = Object.freeze({
    socketPath: rpcOptions.socketPath,
    timeoutMs: rpcOptions.timeoutMs,
    onCall: options.onCall,
    onUnknown: options.onUnknown,
    closed: closer.signal,
  });
  let closed = false;
  return {
    capabilities,
    serverInfo,
    transport,
    async call<M extends Method>(method: M, params: ParamsOf<M>, options: CallOptions = {}): Promise<ResultOf<M>> {
      if (closed) {
        throw new HerdrTransportError(ErrorText.ClientClosed(method));
      }
      assertCapability(method, capabilities);
      return rpc({ ...rpcOptions, signal: options.signal }, method, params);
    },
    close(): void {
      closed = true;
      closer.abort();
    },
  };
}
