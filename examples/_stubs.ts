// Role: helper names the README examples use that are not part of the package (metrics, render, apply), declared so the examples compile.
// Informs HERDR-ADR-0014 (executable docs) and plan 8 (examples/_stubs.ts); type-level only, never run.
export declare const metrics: { record(method: string, durationMs: number, outcome: string): void };
export declare function render(snapshot: unknown): void;
export declare function apply(frame: unknown): void;
