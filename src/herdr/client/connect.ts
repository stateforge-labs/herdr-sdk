// Role: connect(): ping, protocol policy, capabilities, the capability gate and the full client.
// Informs plan 3.1, HERDR-ADR-0005, plan 3.3, HERDR-ADR-0004, HERDR-ADR-0016; merged by HERDR-ADR-0021 from capability-gate.ts, connect-core.ts, connect.ts.
import { CAPABILITY_GATE, PROTOCOL } from '../generated/index.ts';
import type { Method, ServerCapability } from '../generated/index.ts';
import { UnsupportedByServerError, HerdrTransportError, ProtocolMismatchError } from '../errors.ts';
import type { ClientCapabilities, CallOptions, ClientTransport, ConnectCore, ConnectOptions, CoreClient, ServerInfo, Client, Connect, ConnectPlugin, PluginClient } from './types.ts';
import { ErrorText, ProtocolPolicy, Timeout, EntryKey } from '../../constants.ts';
import { MethodPing } from '../generated/names/method.ts';
import type { Result_pong } from '../generated/results.ts';
import { isSupportedProtocol } from '../wire/codec.ts';
import type { ParamsOf, ResultOf } from '../wire/codec.ts';
import { rpc } from '../wire/rpc.ts';
import type { RpcOptions } from '../wire/rpc.ts';
import { assertSocketExists, resolveSocketPath } from '../wire/socket-path.ts';
import { CLIENT_METHODS } from '../generated/entries/client.ts';
import { PLUGIN_METHODS } from '../generated/entries/plugin.ts';
import { allowedMethods, composeOrClose, ENTRY_MEMBERS, lazyStreams } from './scoped.ts';

const GATES: Partial<Record<Method, ServerCapability>> = CAPABILITY_GATE;

export function assertCapability(method: Method, capabilities: ClientCapabilities): void {
  const capability = GATES[method];
  if (capability !== undefined && capabilities[capability] !== true) {
    throw new UnsupportedByServerError(method, capability);
  }
}

export const connectCore: ConnectCore = async function connectCore(options: ConnectOptions = {}): Promise<CoreClient> {
  const socketPath = resolveSocketPath({ socketPath: options.socketPath, env: options.env });
  assertSocketExists(socketPath);
  const rpcOptions = requestOptions(options, socketPath);
  const pong = await rpc(rpcOptions, MethodPing, {});
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

// A call's own timeoutMs and signal win over the client default; the socket path and onCall always come from the client.
function callRpcOptions(rpcOptions: RpcOptions & { readonly timeoutMs: number }, callOptions: CallOptions): RpcOptions {
  return {
    ...rpcOptions,
    timeoutMs: callOptions.timeoutMs ?? rpcOptions.timeoutMs,
    signal: callOptions.signal,
  };
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
    async call<M extends Method>(method: M, params: ParamsOf<M>, callOptions: CallOptions = {}): Promise<ResultOf<M>> {
      if (closed) {
        throw new HerdrTransportError(ErrorText.ClientClosed(method));
      }
      assertCapability(method, capabilities);
      return rpc(callRpcOptions(rpcOptions, callOptions), method, params);
    },
    close(): void {
      closed = true;
      closer.abort();
    },
  };
}

export const connect: Connect = async function connect(options = {}) {
  const core = await connectCore(options);
  return composeOrClose<Client>(
    core,
    allowedMethods(CLIENT_METHODS),
    ENTRY_MEMBERS[EntryKey.client],
    lazyStreams(core),
  );
};

export const connectPlugin: ConnectPlugin = async function connectPlugin(options = {}) {
  const core = await connectCore(options);
  return composeOrClose<PluginClient>(
    core,
    allowedMethods(PLUGIN_METHODS),
    ENTRY_MEMBERS[EntryKey.plugin],
    lazyStreams(core),
  );
};
