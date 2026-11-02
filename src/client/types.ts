// Role: the public types of connect(): its options, the server facts it reports and the Client handle.
// Informs HERDR-ADR-0004 (Promise core), plan 3.1 (capabilities) and plan 3.3 (connect options: socketPath, timeoutMs, protocolPolicy, onCall).
import type { ProtocolPolicy } from '../constants.ts';
import type { Method } from '../generated/index.ts';
import type { ServerCapabilities } from '../generated/results.ts';
import type { EnvMap } from '../wire/socket-path.ts';
import type { OnCall } from '../wire/call-hook.ts';
import type { ParamsOf, ResultOf } from '../wire/typed.ts';

export interface ConnectOptions {
  readonly socketPath?: string | undefined;
  readonly timeoutMs?: number | undefined;
  readonly protocolPolicy?: ProtocolPolicy | undefined;
  readonly onCall?: OnCall | undefined;
  readonly env?: EnvMap | undefined;
}

export interface CallOptions {
  readonly signal?: AbortSignal | undefined;
}

// What the server advertised in its pong. A missing capability is not advertised, so every key is optional here.
export type ClientCapabilities = Readonly<Partial<ServerCapabilities>>;

export interface ServerInfo {
  readonly protocol: number;
  readonly version: string;
}

export interface Client {
  readonly capabilities: ClientCapabilities;
  readonly server: ServerInfo;
  call<M extends Method>(method: M, params: ParamsOf<M>, options?: CallOptions): Promise<ResultOf<M>>;
  close(): void;
}
