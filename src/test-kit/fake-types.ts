// Role: the public types of the minimal fake: what a test may pass to createFakeHerdr and what the fake hands back.
// Informs plan 5 (createFakeHerdr options and the 2a minimum API) and HERDR-ADR-0008 (test kit on node:net); new.
import type { ErrorBody } from '../generated/index.ts';
import type { ServerCapabilities } from '../generated/results.ts';

export interface FakeHerdrOptions {
  // Protocol number the pong reports; defaults to the library's PROTOCOL.
  readonly protocol?: number | undefined;
  // Socket path to listen on; defaults to a fresh temp directory the fake removes on stop.
  readonly socketPath?: string | undefined;
  // Capabilities the pong advertises. Undefined: the default set. Null: the pong omits the field.
  readonly capabilities?: ServerCapabilities | null | undefined;
}

export interface FakeHerdr {
  readonly path: string;
  // Answers a method with a result envelope.
  reply(method: string, result: unknown): void;
  // Answers a method with an error envelope.
  fail(method: string, error: ErrorBody): void;
  // Accepts a method and never answers; the connection stays open until the client closes it.
  silent(method: string): void;
  // Writes the raw line for a method, then ends the connection.
  rawReply(method: string, line: string): void;
  // Every request method received, in order (a test convenience, not herdr behaviour).
  receivedMethods(): readonly string[];
  // Connections the fake holds open right now.
  connectionCount(): number;
  // Closes the server, destroys open connections and removes the temp directory when the fake made it.
  stop(): Promise<void>;
}
