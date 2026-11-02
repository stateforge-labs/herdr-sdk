// Role: helper names the README snippets use (metrics, render, apply), declared so the snippets compile (plan 8 examples/_stubs.ts pattern).
// Informs HERDR-ADR-0014 (executable docs) and HERDR-ADR-0017 (contract tests); type-level only, never run.
export declare const metrics: { record(method: string, durationMs: number, outcome: string): void };
export declare function render(snapshot: unknown): void;
export declare function apply(frame: unknown): void;
