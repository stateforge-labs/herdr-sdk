// Role: layer rule as data for tools/scripts/check-layers.ts; which src layer may import which, which bare packages each may use.
// Informs HERDR-ADR-0003 (generated <- wire <- client <- effect; test-kit imports wire and generated only) and plan section 3 (dependency rule); new.

export const Layer = {
  Generated: 'generated',
  Constants: 'constants',
  Wire: 'wire',
  Client: 'client',
  Effect: 'effect',
  Drift: 'drift',
  TestKit: 'test-kit',
  Model: 'model',
  ModelFromWire: 'model/from-wire',
  Core: 'core',
  CoreTestKit: 'core-test-kit',
  Errors: 'errors',
  Entry: 'entry',
} as const;

export type Layer = (typeof Layer)[keyof typeof Layer];

export const ALL_LAYERS: readonly Layer[] = Object.values(Layer);

// Folders under src/ and the layer each one is; the longest matching folder wins (HERDR-ADR-0021: one folder per product).
// Any other folder is an unknown layer and fails the gate.
export const FOLDER_LAYERS: Readonly<Record<string, Layer>> = {
  'herdr/generated': Layer.Generated,
  'herdr/wire': Layer.Wire,
  'herdr/client': Layer.Client,
  'herdr/effect': Layer.Effect,
  'herdr/test-kit': Layer.TestKit,
  'herdr/model': Layer.Model,
  drift: Layer.Drift,
  core: Layer.Core,
  'core/test-kit': Layer.CoreTestKit,
};

// Single files under src/ that are not entries.
export const SourcePath = {
  Constants: 'constants.ts',
  // HERDR-ADR-0021: every error of the herdr server client and its tools, importable by every herdr layer and drift.
  HerdrErrors: 'herdr/errors.ts',
  ModelFromWire: 'herdr/model/from-wire.ts',
} as const;

// Top-level files under src/ that are subpath entries (one file per subpath export).
export const EntryFile = {
  Effect: 'effect.ts',
  TestKit: 'test-kit.ts',
  CoreTestKit: 'core-test-kit.ts',
} as const;

// Every top-level file under src/ that is an entry: one per package.json "exports" subpath (a test checks the two agree).
// Only these get the entry layer's right to import every layer; any other top-level file is an unknown layer and fails the gate.
export const ENTRY_FILES: readonly string[] = ['index.ts', 'read-only.ts', 'admin.ts', 'effect.ts', 'schema.ts', 'drift.ts', 'test-kit.ts', 'core.ts', 'core-test-kit.ts'];

export const PackageName = {
  Effect: 'effect',
  NodeBuiltinPrefix: 'node:',
} as const;

// A layer may import only the layers listed for it (the import of its own layer is always included).
export const ALLOWED_IMPORTS: Readonly<Record<Layer, readonly Layer[]>> = {
  [Layer.Generated]: [Layer.Generated],
  [Layer.Constants]: [Layer.Constants, Layer.Generated],
  [Layer.Errors]: [Layer.Errors, Layer.Constants, Layer.Generated],
  [Layer.Wire]: [Layer.Wire, Layer.Errors, Layer.Constants, Layer.Generated],
  [Layer.Client]: [Layer.Client, Layer.Errors, Layer.Wire, Layer.Constants, Layer.Generated],
  [Layer.Effect]: [Layer.Effect, Layer.Errors, Layer.Client, Layer.Wire, Layer.Constants, Layer.Generated],
  [Layer.Drift]: [Layer.Drift, Layer.Errors, Layer.Constants, Layer.Generated],
  [Layer.TestKit]: [Layer.TestKit, Layer.Errors, Layer.Wire, Layer.Constants, Layer.Generated],
  [Layer.Model]: [Layer.Model],
  [Layer.ModelFromWire]: [Layer.Model, Layer.Generated],
  // HERDR-ADR-0020: the herdr-core client stands alone; its test kit sees only it.
  [Layer.Core]: [Layer.Core],
  [Layer.CoreTestKit]: [Layer.CoreTestKit, Layer.Core],
  [Layer.Entry]: ALL_LAYERS,
};

// Folders that only their own entry file may import (nothing imports test-kit except tests).
export const RESTRICTED_FOLDERS: Readonly<Partial<Record<Layer, string>>> = {
  [Layer.TestKit]: EntryFile.TestKit,
  [Layer.CoreTestKit]: EntryFile.CoreTestKit,
};

// Bare package names each layer may import.
export const PACKAGE_ALLOWED: Readonly<Record<Layer, readonly string[]>> = {
  [Layer.Generated]: [],
  [Layer.Constants]: [],
  [Layer.Wire]: [],
  [Layer.Client]: [],
  [Layer.Effect]: [PackageName.Effect],
  [Layer.Drift]: [],
  [Layer.TestKit]: [],
  [Layer.Model]: [],
  [Layer.ModelFromWire]: [],
  [Layer.Core]: [],
  [Layer.CoreTestKit]: [],
  [Layer.Errors]: [],
  [Layer.Entry]: [],
};

// Entry files that may import a package their layer does not allow.
export const ENTRY_PACKAGE_ALLOWED: Readonly<Record<string, readonly string[]>> = {
  [EntryFile.Effect]: [PackageName.Effect],
};

// Layers that may not use node builtins at all.
export const NODE_FORBIDDEN_LAYERS: readonly Layer[] = [Layer.Generated, Layer.Model];

// Directories outside src/ that src/ code may never import (named in the violation reason).
export const FORBIDDEN_TARGET_DIRS: readonly string[] = ['tools', 'test', 'examples', 'bin'];

// Layers whose code uses the MethodX constants, never the Method object as a value (plan 10.1 step 2): the Method object would carry every name into the bundle.
export const METHOD_VALUE_LAYERS: readonly Layer[] = [Layer.Client, Layer.Wire, Layer.Effect];

// A text rule applies to every src/ file, or only to the files of `layers` when it is given.
// A text rule: `layers` limits it to those layers, `exempt` names files (under src/) it skips, `ignore` is text removed from a line before the test.
export interface TextRule {
  readonly id: string;
  readonly pattern: RegExp;
  readonly reason: string;
  readonly layers?: readonly Layer[];
  readonly exempt?: readonly string[];
  readonly ignore?: RegExp;
}

// HERDR-ADR-0021: the core client's strings live in its two constants files; the recorded frames are data.
export const CORE_STRING_FILES: readonly string[] = ['core/constants.ts', 'core/test-kit/constants.ts', 'core/test-kit/frames.ts'];

export const FORBIDDEN_TEXT: readonly TextRule[] = [
  { id: 'no-bun-global', pattern: /\bBun\./, reason: 'plan 2: no Bun.* in src/' },
  {
    id: 'no-literal-compare',
    pattern: /[!=]==\s*'[^']*'|'[^']*'\s*[!=]==|\bcase\s+'/,
    reason: 'HERDR-ADR-0021: compare with an as-const object (or dispatch through a KindMap), never with a string literal',
  },
  {
    id: 'core-strings-centralized',
    pattern: /['"`]/,
    reason: 'HERDR-ADR-0021: a string of the core client lives in core/constants.ts (or core/test-kit/constants.ts), not inline',
    layers: [Layer.Core, Layer.CoreTestKit],
    exempt: CORE_STRING_FILES,
    ignore: /^\s*(?:import|export)\b.*\bfrom\s+'[^']*';?\s*$|^\s*\}\s*from\s+'[^']*';\s*$|\b[Bb]rand<[^>]*>|\bBrand<[^>]*>/g,
  },
  {
    id: 'method-value-use',
    pattern: /\bMethod\.[A-Za-z]/,
    reason: 'plan 10.1 step 2: use the MethodX constant, not the Method object, in client, wire and effect',
    layers: METHOD_VALUE_LAYERS,
  },
  {
    // `import type { Method }` and `import { type Method }` are type-only and allowed; a bare `Method` in a value import is not.
    id: 'method-value-import',
    pattern: /\bimport\s*\{[^}]*(?<!type\s)\bMethod\b/,
    reason: 'plan 10.1 step 2: import the MethodX constant, not the Method object, in client, wire and effect',
    layers: METHOD_VALUE_LAYERS,
  },
];

export const RuleId = {
  layer: 'layer-rule',
  restricted: 'restricted-folder',
  outside: 'src-outside',
  unknownLayer: 'unknown-layer',
  explicitTs: 'explicit-ts',
  package: 'package-import',
  nodeBuiltin: 'node-builtin',
  text: 'forbidden-text',
} as const;
