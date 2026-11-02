// Role: connect(): finds the socket, checks it is a socket, pings once, applies the protocol policy and returns a Client that gates methods by capability.
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
import type { CallOptions, Client, ClientCapabilities, ConnectOptions, ServerInfo } from './types.ts';

export async function connect(options: ConnectOptions = {}): Promise<Client> {
  const socketPath = resolveSocketPath({ socketPath: options.socketPath, env: options.env });
  assertSocketExists(socketPath);
  const rpcOptions = requestOptions(options, socketPath);
  const pong = await rpc(rpcOptions, Method.Ping, {});
  checkProtocol(pong, options.protocolPolicy ?? ProtocolPolicy.Exact);
  return createClient(rpcOptions, pong);
}

function requestOptions(options: ConnectOptions, socketPath: string): RpcOptions {
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

// The capabilities and server facts are fixed at connect time; a closed client refuses every call without contacting herdr.
function createClient(rpcOptions: RpcOptions, pong: Result_pong): Client {
  const capabilities: ClientCapabilities = Object.freeze({ ...(pong.capabilities ?? {}) });
  const server: ServerInfo = Object.freeze({ protocol: pong.protocol, version: pong.version });
  let closed = false;
  return {
    capabilities,
    server,
    async call<M extends Method>(method: M, params: ParamsOf<M>, options: CallOptions = {}): Promise<ResultOf<M>> {
      if (closed) {
        throw new HerdrTransportError(ErrorText.ClientClosed(method));
      }
      assertCapability(method, capabilities);
      return rpc({ ...rpcOptions, signal: options.signal }, method, params);
    },
    close(): void {
      closed = true;
    },
  };
}
