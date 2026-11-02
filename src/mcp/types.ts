// Role: CONTRACT of the /mcp add-on: toolkit options and tool naming, the bearer guard, the token file; the effect/ai-typed members are locked in prose and typed in amendment A1.
// Informs HERDR-ADR-0017 (locked seam; read-only for every lane), HERDR-ADR-0010 (read-only MCP on effect/ai, out of the core) and plan 7.
import type { Method } from '../generated/index.ts';
import type { EntryMethod } from '../client/types.ts';
import type { LongPollMethod } from '../client/long-poll/types.ts';

/** Methods a read-only tool may wrap: R-meta only (no long-poll, no subscribe, no content). */
export type ReadOnlyToolMethod = Exclude<EntryMethod<'readOnly'>, LongPollMethod | typeof Method.EventsSubscribe>;

export interface ReadOnlyToolkitOptions {
  /** One tool per method, named by toolNameOf, each with readOnlyHint: true. A write method can never be listed. */
  readonly methods: readonly ReadOnlyToolMethod[];
}

/** `herdr_` + the method with dots as underscores (McpToolName). Pure. Implemented by mcp/tool-name.ts (P6c). */
export type ToolNameOf = (method: ReadOnlyToolMethod) => string;

/**
 * Checks an HTTP Authorization header against the expected token: `Bearer <token>`, compared in constant time.
 * Returns false for a missing or malformed header. Implemented by mcp/bearer-guard.ts (P6c).
 */
export type BearerGuard = (expectedToken: string) => (authorization: string | undefined) => boolean;

export interface TokenFileOptions {
  readonly path: string;
}

/** A token kept in a file the owner can read (mode 0600). */
export interface TokenFileHandle {
  readonly path: string;
  /** Reads the token; creates the file with a fresh random token first when it does not exist. */
  readOrCreate(): Promise<string>;
}

/** Implemented by mcp/token-file.ts (P6c). Checked against S7's mcp-token-file.ts when S7 merges (open issue in contracts.md). */
export type TokenFile = (options: TokenFileOptions) => TokenFileHandle;

/*
 * LOCKED IN PROSE, TYPED IN AMENDMENT A1 (P6c builds exactly this):
 * - `readOnlyToolkit(options: ReadOnlyToolkitOptions)`: an effect/ai `Toolkit` with one `Tool` per method, needing the
 *   `HerdrReadOnly` service; parameters schema from PARAMS_SHAPE; annotation readOnlyHint true.
 * - `toolResult(outcome: Exit<unknown, HerdrTaggedError>)`: the MCP tool result: JSON text content for a result;
 *   isError with "<_tag>: <message>" for a tagged error (atalaya src/messaging/mcp/tool-result.ts pattern).
 */
