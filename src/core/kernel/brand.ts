// Role: the brand helper of the core layer: a nominal type over a primitive carrier.
// Informs HERDR-ADR-0020 (the herdr-core client); ported from the desktop work in herdr-plugins.
declare const marker: unique symbol;

export type Brand<Carrier, Name> = Carrier & { readonly [marker]: Name };

export function brand<Carrier, Name>(carrier: Carrier): Brand<Carrier, Name> {
  return carrier as Brand<Carrier, Name>;
}
