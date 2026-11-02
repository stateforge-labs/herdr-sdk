// Role: lane-local message texts of the long-poll helpers (not shared, so they stay out of the read-only src/constants.ts).
// Informs HERDR-ADR-0007 and plan 3.6 (agent.start bounds); lane-internal to P4a.
export const LongPollText = {
  OutOfBounds: (method: string, value: number, exclusiveMin: number, max: number): string =>
    `${method}: timeout_ms ${value} must be greater than ${exclusiveMin} and at most ${max}`,
} as const;
