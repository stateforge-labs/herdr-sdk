// Role: what the fake does for each method (canned result, error, raw line or silence) and the record of the requests it received.
// Informs plan 5 (reply, fail, silent, rawReply, receivedMethods, requests) and HERDR-ADR-0016 (the fake facts and the W1 reuse test); test-kit only.
import type { ErrorBody } from '../generated/index.ts';
import type { ReceivedRequest } from './types.ts';

export class FakeScript {
  private readonly replies = new Map<string, unknown>();
  private readonly failures = new Map<string, ErrorBody>();
  private readonly rawLines = new Map<string, string>();
  private readonly silences = new Set<string>();
  private readonly received: ReceivedRequest[] = [];

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

  record(request: ReceivedRequest): void {
    this.received.push(request);
  }

  methods(): readonly string[] {
    return this.received.map((request) => request.method);
  }

  requests(): readonly ReceivedRequest[] {
    return [...this.received];
  }

  // True when a test scripted this method to be silent, raw or refused; such a method is not acknowledged as a subscription.
  hasScriptedOutcome(method: string): boolean {
    return this.silences.has(method) || this.rawLines.has(method) || this.failures.has(method);
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
