// Role: CONTRACT of the /effect entry: layer options, the tagged-error shapes and the Promise-error mapping; the Effect-typed members are locked in prose below and land as types in amendment A1.
// Informs HERDR-ADR-0017 (locked seam; read-only for every lane), HERDR-ADR-0004 (Effect as optional peer), HERDR-ADR-0005 (four services) and plan 3.7.
// Why prose: `effect` 4.1.2 (released 2026-11-02) is not 14 days old until 2026-11-16 (HERDR-ADR-0015), so no file may import it yet;
// lane P6a starts after that date anyway (plan 2). Amendment A1 (architect, on 2026-11-16, before P6a starts) turns the prose into types.
import type { EffectErrorTag, ProtocolPolicy } from '../constants.ts';
import type { Method, ServerCapability } from '../generated/index.ts';
import type { EnvMap } from '../wire/socket-path.ts';
import type { OnCall, UnknownFrame } from '../wire/types.ts';

/** Options of every Herdr layer. timeoutMs is required: no default timeout, the composition root decides (plan 3.7). */
export interface HerdrLayerOptions {
  readonly socketPath?: string | undefined;
  readonly timeoutMs: number;
  readonly protocolPolicy?: ProtocolPolicy | undefined;
  readonly onCall?: OnCall | undefined;
  /** Same rule as ConnectOptions.onUnknown (client hook first, then any per-call hook). */
  readonly onUnknown?: ((frame: UnknownFrame) => void) | undefined;
  /** Same as ConnectOptions.env; tests pass their own. */
  readonly env?: EnvMap | undefined;
}

/**
 * Fields of each tagged error (same `_tag`s and fields as hub kernel/herdr-errors.ts; plan 3.7 table). Every shape has
 * `message` (Data.TaggedError provides it; it is the Promise error's message), so toolResult reads it without a cast.
 */
export interface HerdrRefusedShape {
  readonly _tag: typeof EffectErrorTag.Refused;
  readonly method: string;
  readonly code: string;
  readonly message: string;
}
export interface HerdrUnavailableShape {
  readonly _tag: typeof EffectErrorTag.Unavailable;
  readonly message: string;
  readonly cause: unknown;
  readonly isTimeout: boolean;
}
export interface ProtocolMismatchShape {
  readonly _tag: typeof EffectErrorTag.ProtocolMismatch;
  readonly message: string;
  readonly expected: number;
  readonly actual: number;
}
export interface HerdrUnsupportedShape {
  readonly _tag: typeof EffectErrorTag.Unsupported;
  readonly message: string;
  readonly method: Method;
  readonly capability: ServerCapability;
}

/** Every error an Effect herdr call can fail with. P6a's Data.TaggedError classes satisfy these shapes structurally. */
export type HerdrTaggedError = HerdrRefusedShape | HerdrUnavailableShape | ProtocolMismatchShape | HerdrUnsupportedShape;

/**
 * Maps a Promise-core error to its tagged error: HerdrError -> HerdrRefused; HerdrTransportError and SubscriptionEnded
 * -> HerdrUnavailable; ProtocolMismatchError -> ProtocolMismatch; UnsupportedByServerError -> HerdrUnsupported;
 * anything else -> HerdrUnavailable with the value as cause. Implemented by effect/to-tagged-error.ts (P6a).
 */
export type ToTaggedError = (error: unknown) => HerdrTaggedError;

/*
 * LOCKED IN PROSE, TYPED IN AMENDMENT A1 (P6a builds exactly this; it may not change it):
 *
 * - Services (Context tags): `Herdr`, `HerdrReadOnly`, `HerdrPrompt`, `HerdrAdmin`, with service shapes
 *   `EffectNamespaces<ClientNamespaces | ReadOnlyNamespaces | PromptNamespaces | AdminNamespaces>`: the generated namespace
 *   type with every `(params, options?) => Promise<R>` leaf mapped to `(params, options?) => Effect<R, HerdrTaggedError>`,
 *   built by one runtime wrapper over the Promise tree (plan 3.7: no second decoder).
 * - Base members of every service: `capabilities: ClientCapabilities` and `serverInfo: ServerInfo` (plain values, read
 *   from the Promise client). No `close`: the layer's scope closes the client (Layer.scoped + acquireRelease).
 * - Streams: `events.subscribe(specs, options?: SubscribeOptions)` maps to `Stream<DecodedFrame, HerdrTaggedError>`;
 *   `watch(options: EffectWatchOptions<S, E>)` to `Stream<WatchChange<S>, HerdrTaggedError | E>`, where
 *   `EffectWatchOptions<S, E>` is `WatchOptions<S>` with `snapshot: Effect<S, E>` (an Effect, not a Promise function; the
 *   wrapper runs it with Effect.runPromise and the watch abort signal) and without `signal` (fiber interruption ends it).
 *   `hold()` maps to `Effect<HeldConnection, HerdrTaggedError, Scope>` (closed with the scope).
 * - Layers: `Herdr.layer(options: HerdrLayerOptions)`, `Herdr.layerReadOnly(options: HerdrLayerOptions & ReadOnlyOptions)`,
 *   `Herdr.layerPrompt(options: HerdrLayerOptions)`, `Herdr.layerAdmin(options: HerdrLayerOptions)`; each
 *   `Layer<Service, ProtocolMismatch | HerdrUnavailable>` (connect runs in the layer). onUnknown and env are layer options.
 * - `watchPaneSet(herdr: EffectNamespaces<ReadOnlyNamespaces>, options?: WatchPaneSetOptions): Stream<PaneSetChange, HerdrTaggedError>`,
 *   a wrapper over client/watch watchPaneSet (P4b). It adapts the service to a PaneSetSource with one bridge:
 *   `pane.list` = `(params) => Effect.runPromise(herdr.pane.list(params))` and `events.subscribe` taken from the Promise
 *   client the layer holds (the service keeps a private reference to it; no second subscribe implementation).
 * - Fiber interruption destroys the connection (rpc signal, subscription close, held close).
 * - Stubs: A1 also creates `src/effect/services.ts` exporting the four tags (declared) and the four layers as typed
 *   stubs that throw NotImplementedError (Lane.P6a), so P6c can import the tags and build a test layer the day A1 lands.
 */
