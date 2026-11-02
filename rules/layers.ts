// Role: layer rule as data for scripts/check-layers.ts; which src layer may import which, which bare packages each may use.
// Informs HERDR-ADR-0003 (generated <- wire <- client <- {effect, mcp}; test-kit imports wire and generated only) and plan section 3 (dependency rule); new.

export const Layer = {
  Generated: 'generated',
  Constants: 'constants',
  Wire: 'wire',
  Client: 'client',
  Effect: 'effect',
  Drift: 'drift',
  TestKit: 'test-kit',
  Mcp: 'mcp',
  Model: 'model',
  ModelFromWire: 'model/from-wire',
  Entry: 'entry',
} as const;

export type Layer = (typeof Layer)[keyof typeof Layer];

export const ALL_LAYERS: readonly Layer[] = Object.values(Layer);

// Folders under src/ and the layer each one is. Any other folder is an unknown layer and fails the gate.
export const FOLDER_LAYERS: readonly Layer[] = [
  Layer.Generated,
  Layer.Wire,
  Layer.Client,
  Layer.Effect,
  Layer.Drift,
  Layer.TestKit,
  Layer.Mcp,
  Layer.Model,
];

// Single files under src/ that are not entries.
export const SourcePath = {
  Constants: 'constants.ts',
  // HERDR-ADR-0017: the shared NotImplemented helper of the contract stubs; same layer as constants (importable by every layer but generated and model).
  NotImplemented: 'not-implemented.ts',
  ModelFromWire: 'model/from-wire.ts',
} as const;

// Top-level files under src/ that are subpath entries (one file per subpath export).
export const EntryFile = {
  Effect: 'effect.ts',
  Mcp: 'mcp.ts',
  TestKit: 'test-kit.ts',
} as const;

export const PackageName = {
  Effect: 'effect',
  NodeBuiltinPrefix: 'node:',
} as const;

// A layer may import only the layers listed for it (the import of its own layer is always included).
export const ALLOWED_IMPORTS: Readonly<Record<Layer, readonly Layer[]>> = {
  [Layer.Generated]: [Layer.Generated],
  [Layer.Constants]: [Layer.Constants, Layer.Generated],
  [Layer.Wire]: [Layer.Wire, Layer.Constants, Layer.Generated],
  [Layer.Client]: [Layer.Client, Layer.Wire, Layer.Constants, Layer.Generated],
  [Layer.Effect]: [Layer.Effect, Layer.Client, Layer.Wire, Layer.Constants, Layer.Generated],
  // HERDR-ADR-0010: the MCP toolkit is a read-only client built on the /effect services (HerdrReadOnly, HerdrTaggedError)
  // and the effect package (see PACKAGE_ALLOWED). Contract review finding: P6c needs src/effect.
  [Layer.Mcp]: [Layer.Mcp, Layer.Effect, Layer.Client, Layer.Wire, Layer.Constants, Layer.Generated],
  [Layer.Drift]: [Layer.Drift, Layer.Constants, Layer.Generated],
  [Layer.TestKit]: [Layer.TestKit, Layer.Wire, Layer.Constants, Layer.Generated],
  [Layer.Model]: [Layer.Model],
  [Layer.ModelFromWire]: [Layer.Model, Layer.Generated],
  [Layer.Entry]: ALL_LAYERS,
};

// Folders that only their own entry file may import (nothing imports test-kit or mcp except tests).
export const RESTRICTED_FOLDERS: Readonly<Partial<Record<Layer, string>>> = {
  [Layer.TestKit]: EntryFile.TestKit,
  [Layer.Mcp]: EntryFile.Mcp,
};

// Bare package names each layer may import.
export const PACKAGE_ALLOWED: Readonly<Record<Layer, readonly string[]>> = {
  [Layer.Generated]: [],
  [Layer.Constants]: [],
  [Layer.Wire]: [],
  [Layer.Client]: [],
  [Layer.Effect]: [PackageName.Effect],
  [Layer.Mcp]: [PackageName.Effect],
  [Layer.Drift]: [],
  [Layer.TestKit]: [],
  [Layer.Model]: [],
  [Layer.ModelFromWire]: [],
  [Layer.Entry]: [],
};

// Entry files that may import a package their layer does not allow.
export const ENTRY_PACKAGE_ALLOWED: Readonly<Record<string, readonly string[]>> = {
  [EntryFile.Effect]: [PackageName.Effect],
  [EntryFile.Mcp]: [PackageName.Effect],
};

// Layers that may not use node builtins at all.
export const NODE_FORBIDDEN_LAYERS: readonly Layer[] = [Layer.Generated, Layer.Model];

// Directories outside src/ that src/ code may never import (named in the violation reason).
export const FORBIDDEN_TARGET_DIRS: readonly string[] = ['gen', 'test', 'scripts', 'rules', 'examples', 'bin'];

export const FORBIDDEN_TEXT: readonly { readonly id: string; readonly pattern: RegExp; readonly reason: string }[] = [
  { id: 'no-bun-global', pattern: /\bBun\./, reason: 'plan 2: no Bun.* in src/' },
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
