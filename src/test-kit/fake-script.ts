// Role: what the fake does for each method (canned result, error, raw line or silence) and the record of the methods it received.
// Informs plan 5 (reply, fail, silent, rawReply, receivedMethods) and HERDR-ADR-0016 (fake facts and the W1 reuse test); test-kit only.
import type { ErrorBody } from '../generated/index.ts';

export class FakeScript {
  private readonly replies = new Map<string, unknown>();
  private readonly failures = new Map<string, ErrorBody>();
  private readonly rawLines = new Map<string, string>();
  private readonly silences = new Set<string>();
  private readonly received: string[] = [];

  setReply(method: string, result: unknown): void {
    this.replies.set(method, result);
  }

  setFailure(method: string, error: ErrorBody): void {
    this.failures.set(method, error);
  }

  setRawLine(method: string, line: string): void {
    this.rawLines.set(method, line);
  }

  setSilent(method: string): void {
    this.silences.add(method);
  }

  record(method: string): void {
    this.received.push(method);
  }

  methods(): readonly string[] {
    return [...this.received];
  }

  isSilent(method: string): boolean {
    return this.silences.has(method);
  }

  rawLineOf(method: string): string | undefined {
    return this.rawLines.get(method);
  }

  failureOf(method: string): ErrorBody | undefined {
    return this.failures.get(method);
  }

  hasReply(method: string): boolean {
    return this.replies.has(method);
  }

  replyOf(method: string): unknown {
    return this.replies.get(method);
  }
}
