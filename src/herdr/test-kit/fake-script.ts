// Role: what the fake was told to do for each method (replies, failures, sequences, raw lines, silence) and the record of the requests it received.
// Informs plan 5 (reply, fail, silent, rawReply, replySequence, receivedMethods, requests) and HERDR-ADR-0016 (the fake facts and the W1 reuse test); test-kit only.
import type { ErrorBody } from '../generated/index.ts';
import type { ReceivedRequest } from './types.ts';

// One scripted step: a result, or an error envelope. The typed FakeHerdr.replySequence checks each step against its method.
export type ScriptedStep = { readonly result: unknown } | { readonly error: ErrorBody };

export class FakeScript {
  private readonly replies = new Map<string, unknown>();
  private readonly failures = new Map<string, ErrorBody>();
  private readonly rawLines = new Map<string, string>();
  private readonly silences = new Set<string>();
  private readonly sequences = new Map<string, ScriptedStep[]>();
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

  // Stores a copy, so a later change to the caller's array does not change the script.
  setSequence(method: string, steps: readonly ScriptedStep[]): void {
    this.sequences.set(method, [...steps]);
  }

  // The next step of the sequence, consumed; undefined when the method has no steps left.
  takeStep(method: string): ScriptedStep | undefined {
    return this.sequences.get(method)?.shift();
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

  // True when a test scripted this method to be silent, raw, refused or with steps left; such a method is not acknowledged as a subscription.
  // A reply alone does not count: events.subscribe is answered by its ack (F2) unless a test scripts one of the outcomes above.
  hasScriptedOutcome(method: string): boolean {
    return this.silences.has(method) || this.rawLines.has(method) || this.failures.has(method) || (this.sequences.get(method)?.length ?? 0) > 0;
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
