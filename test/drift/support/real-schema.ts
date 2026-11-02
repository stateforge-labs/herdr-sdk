// Role: copy-on-read of the committed schema/herdr-api.schema.json and herdr-version.json; the files are never edited by the tests.
// Informs HERDR-ADR-0009 (the identity case compares the committed copy with itself) and HERDR-ADR-0017 (test support of lane P5c).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { SchemaDocument } from '../../../src/drift/types.ts';

const SCHEMA_DIR = fileURLToPath(new URL('../../../schema', import.meta.url));

export function committedSchemaText(): string {
  return readFileSync(`${SCHEMA_DIR}/herdr-api.schema.json`, 'utf8');
}

export function committedSchemaDocument(): SchemaDocument {
  return JSON.parse(committedSchemaText()) as SchemaDocument;
}

export function committedVersionText(): string {
  return readFileSync(`${SCHEMA_DIR}/herdr-version.json`, 'utf8');
}

export function committedDirectory(): string {
  return SCHEMA_DIR;
}
