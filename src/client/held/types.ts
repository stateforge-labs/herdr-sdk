// Role: CONTRACT of hold(): a held connection for the class C (connection-bound) methods, closed explicitly or by `await using`.
// Informs HERDR-ADR-0017 (locked seam; read-only for every lane), HERDR-ADR-0007 and plan 3.6 (held connections).
import type { HeldNamespaces } from '../../generated/index.ts';
import type { AllowedMethods, BuildNamespaceTree, ClientCapabilities } from '../types.ts';
import type { OnCall, OpenDedicated } from '../../wire/types.ts';

/**
 * One dedicated connection carrying the class C methods as namespaces (`held.client.window_title.set`,
 * `held.client_shell.surface.set`, `held.server.ssh_agent.register`); capability gates apply (UnsupportedByServerError
 * before sending). Closing it ends the registration, lease or title. If the server closes it, `ended` resolves and
 * every later call rejects with HerdrTransportError.
 */
export interface HeldConnection extends HeldNamespaces, AsyncDisposable {
  readonly ended: Promise<void>;
  /** Destroys the connection. Idempotent. */
  close(): Promise<void>;
}

export interface HoldOptions {
  readonly signal?: AbortSignal | undefined;
}

/** `herdr.hold(options)`. */
export type Hold = (options?: HoldOptions) => Promise<HeldConnection>;

/**
 * What the client hands the hold factory. The held tree is built with the same builder and allow-list as every
 * client (P2b's buildNamespaceTree and allowedMethods('held')); they are injected so P4b's unit tests can pass a tiny
 * builder, and P2b passes the real ones. Each leaf is an Invoke that applies the capability gate, then sends on the
 * dedicated connection.
 */
export interface HoldDeps {
  readonly socketPath: string;
  /** The client's resolved timeout (ClientTransport.timeoutMs). */
  readonly timeoutMs: number;
  readonly capabilities: ClientCapabilities;
  readonly onCall?: OnCall | undefined;
  readonly open: OpenDedicated;
  readonly buildTree: BuildNamespaceTree;
  readonly allowedMethods: AllowedMethods;
  /** The client close signal (ClientTransport.closed): when it aborts, every held connection of this client closes. */
  readonly signal: AbortSignal;
}

/** Builds hold() of one client. Implemented by client/held/hold.ts (P4b). */
export type CreateHold = (deps: HoldDeps) => Hold;
