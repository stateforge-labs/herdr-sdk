// Role: lane-local message texts of the subscribe layer (not shared, so they stay out of the read-only src/constants.ts).
// Informs HERDR-ADR-0016 (W2 malformed push) and plan 3.6 (bounded queue); lane-internal to P4a.
export const SubscribeText = {
  MalformedPush: 'events.subscribe: malformed push line',
  QueueFull: (max: number): string => `subscription queue is full (max ${max})`,
} as const;
