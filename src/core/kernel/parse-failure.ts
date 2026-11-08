// Role: why a parser of the core layer refused its input.
// Informs HERDR-ADR-0020 (the herdr-core client); ported from the desktop work in herdr-plugins.
export type ParseFailure =
  | { readonly kind: 'not-a-string' }
  | { readonly kind: 'not-a-number' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'not-an-integer' }
  | { readonly kind: 'not-a-row' }
  | { readonly kind: 'out-of-range' };
