// Role: every literal of the size gate (tools/scripts/check-size.ts): the measured rows, their dist files, the scenario files, the budgets, the forbidden inputs and the bun build arguments.
// Informs plan 10.1 (size table), HERDR-ADR-0015 (budgets per consumer scenario, measured on dist/) and HERDR-ADR-0005 (read-only never pulls admin or effect).

// Rows of the size table. Dist rows measure one compiled entry; scenario rows measure a consumer that imports the package by name.
export const SizeRow = {
  Core: 'dist .',
  ReadOnly: 'dist /read-only',
  Admin: 'dist /admin',
  Effect: 'dist /effect',
  Schema: 'dist /schema',
  Lazy: 'lazy chunks of .',
  ScenarioA: 'scenario a',
  ScenarioAPreset: 'scenario a-preset',
  ScenarioB: 'scenario b',
  ScenarioC: 'scenario c',
} as const;
export type SizeRow = (typeof SizeRow)[keyof typeof SizeRow];

// Compiled entry files of the package (tsc -p tsconfig.build.json), relative to the package root.
export const SizeDistFile = {
  Core: 'dist/index.js',
  ReadOnly: 'dist/read-only.js',
  Admin: 'dist/admin.js',
  Effect: 'dist/effect.js',
  Schema: 'dist/schema.js',
} as const;

// Scenario sources, relative to the package root. Each is copied next to a node_modules symlink to the package, so it imports `@stateforge-labs/herdr/...` the way a consumer does.
export const SizeScenarioFile = {
  A: 'test/size/scenarios/a.ts',
  APreset: 'test/size/scenarios/a-preset.ts',
  B: 'test/size/scenarios/b.ts',
  C: 'test/size/scenarios/c.ts',
} as const;

// Names used to link the package into a scenario's temporary node_modules (the scenario imports `@stateforge-labs/herdr/...`).
export const SizePackage = {
  NodeModules: 'node_modules',
  Scope: '@stateforge-labs',
  PackageDir: 'herdr',
  Scenario: 'scenario.ts',
} as const;

// Bytes per budgeted row: measured after the dist build (2026-11-02, plan 10.1 steps 2 to 4), plus about 10 %, rounded up to 100 B,
// and never above the owner's ceiling of plan 10.1 (scenario a and a-preset land on their ceilings). A budget only moves down when
// the code shrinks; an increase needs a note in HERDR-ADR-0015. Schema is measured and printed only (introspection entry, no budget).
export const SizeBudget: Readonly<Partial<Record<SizeRow, number>>> = {
  [SizeRow.Core]: 29600, // measured 26887 B; ceiling 36000
  [SizeRow.ReadOnly]: 20600, // measured 18691 B; ceiling 24000
  [SizeRow.Admin]: 17200, // measured 15561 B; ceiling 26000
  [SizeRow.Effect]: 4700, // measured 4198 B (unchanged by steps 2 to 4)
  [SizeRow.ScenarioA]: 19000, // measured 17513 B; ceiling 19000 (10 % would be 19300)
  [SizeRow.ScenarioAPreset]: 15000, // measured 14221 B; ceiling 15000 (10 % would be 15700)
  [SizeRow.ScenarioB]: 24400, // measured 22158 B; ceiling 30000
  [SizeRow.ScenarioC]: 16600, // measured 15091 B; ceiling 22000
  [SizeRow.Lazy]: 8500, // measured 7672 B (the streams chunk); ceiling 9000
};

// Strings that must not reach a production row or a scenario (plan 10.1 no-leak check). Matched as substrings of bundle input paths or emitted text.
export const SizeForbidden = {
  TestKit: '/test-kit',
  TestData: '/generated/test-data/',
  DriftData: '/generated/drift/',
  MethodTable: '/generated/method-table',
  EntryMethods: '/generated/entry-methods',
  ChildProcess: 'child_process',
} as const;

// Extra inputs /read-only must never bundle (HERDR-ADR-0005: the read-only entry does not pull /admin or effect).
export const SizeForbiddenReadOnly = {
  Admin: '/admin.js',
  ConnectAdmin: 'connect-admin',
  Effect: '/effect',
} as const;

// Arguments of `bun build` for the size gate: Node target, effect external, code split so dynamic imports form lazy chunks.
export const SizeBuildArg = {
  Build: 'build',
  Target: '--target',
  TargetNode: 'node',
  Minify: '--minify',
  External: '--external',
  Effect: 'effect',
  Splitting: '--splitting',
  Outdir: '--outdir',
  Metafile: '--metafile',
} as const;

// Dynamic-import kind in the bun metafile: chunks reached only through it are lazy.
export const SizeImportKind = {
  Static: 'import-statement',
  Dynamic: 'dynamic-import',
} as const;

// Names of the temporary directories and files of a measurement.
export const SizeTemp = {
  DirPrefix: 'herdr-size-',
  Meta: 'meta.json',
  OutDir: 'out',
} as const;

// Flag of tools/scripts/check-size.ts: print the rows without enforcing the budgets.
export const SizeFlag = {
  Measure: '--measure',
} as const;

// Printed beside a row that has no budget yet.
export const SizeNote = {
  NoBudget: 'not budgeted',
  Over: 'OVER',
  Ok: 'ok',
  Leak: 'LEAK',
} as const;

export const SIZE_MAX_BUFFER_BYTES = 64 * 1024 * 1024;
