// Role: the error a schema throws when a bundle, a definition, a tagged branch or the protocol is missing or malformed; the outcome maps it to NOT COVERED.
// Informs HERDR-ADR-0009 ("could not look" is exit 3, never 0).
import { DriftErrorName } from './constants.ts';

export class MalformedSchemaError extends Error {
  override readonly name: string = DriftErrorName.Malformed;

  constructor(message: string) {
    super(message);
  }
}
