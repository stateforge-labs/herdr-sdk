// Role: one signal that aborts when the watch's own close() runs or the caller's signal aborts.
// Informs plan 3.6 (close() and abort both end the iteration normally) and HERDR-ADR-0016 (lane P4b: watch and watchPaneSet share it).

// AbortSignal.any is on every target (Node >= 22.18, Bun); a missing parent just returns the own signal.
export function linkSignal(own: AbortSignal, parent: AbortSignal | undefined): AbortSignal {
  return parent === undefined ? own : AbortSignal.any([own, parent]);
}
