// Role: paths of the generator test fixtures under test/tools/gen/fixtures.
// Informs HERDR-ADR-0002 (fixture tests for each schema construct, plan section 3.2).
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export const ApiSchemaFixture = {
  tokenPatternsDiffer: join(FIXTURE_DIR, 'token-patterns-differ.schema.json'),
  methodsMini: join(FIXTURE_DIR, 'methods-mini.schema.json'),
  recursiveLayout: join(FIXTURE_DIR, 'recursive-layout.schema.json'),
  nullable: join(FIXTURE_DIR, 'nullable.schema.json'),
  sharedParams: join(FIXTURE_DIR, 'shared-params.schema.json'),
  patternMaps: join(FIXTURE_DIR, 'pattern-maps.schema.json'),
} as const;
