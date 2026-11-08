// Role: the plain-object guard the wire parsers use.
// Informs HERDR-ADR-0020 (the herdr-core client); ported from the desktop work in herdr-plugins.
export type Fields = Readonly<Record<string, unknown>>;

export function isFields(input: unknown): input is Fields {
  return typeof input === 'object' && input !== null;
}
