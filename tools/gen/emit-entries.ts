// Role: emits one module per entry point (entries/) and per named preset (presets/), each a const list of Method constants, plus entry-methods.ts (ENTRY_METHODS) and preset-methods.ts (PRESET_METHODS), the aggregates.
// Informs HERDR-ADR-0002, plan section 3.2 and the 2026-11-02 build amendment (per-entry lists so a consumer carries only the lists it reaches).
import { constKey, kebabOf, upperSnakeOf } from './const-key.ts';
import { entryMethods, presetMethods } from './emit-names.ts';
import type { ApiSchema } from './schema.ts';

// `export const READ_ONLY_METHODS = [MethodAgentExplain, ...] as const;` in a module at dir/file.ts.
function listModule(banner: string, constName: string, methods: readonly string[], doc: string): string {
  const imports = methods.length === 0 ? '' : `import { ${methods.map((name) => `Method${constKey(name)}`).join(', ')} } from '../names/method.ts';\n\n`;
  const items = methods.map((name) => `Method${constKey(name)}`).join(', ');
  return `${banner}\n${imports}/** ${doc} */\nexport const ${constName} = [${items}] as const;\n`;
}

// The entry-point and preset files, keyed by their path under src/herdr/generated/.
export function emitEntryFiles(schema: ApiSchema, banner: string): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const [key, methods] of entryMethods(schema)) {
    const constName = `${upperSnakeOf(key)}_METHODS`;
    files[`entries/${kebabOf(key)}.ts`] = listModule(banner, constName, methods, `Method names of the ${key} entry point, sorted.`);
  }
  for (const [preset, methods] of presetMethods(schema)) {
    const constName = `${upperSnakeOf(preset)}_METHODS`;
    files[`presets/${kebabOf(preset)}.ts`] = listModule(banner, constName, methods, `Method names of the ${preset} preset.`);
  }
  return files;
}

// Every entry and preset list, by its key, for the aggregates in entry-methods.ts.
function aggregate(lists: readonly (readonly [string, readonly string[]])[], kind: 'entries' | 'presets'): readonly { key: string; constName: string; path: string }[] {
  return lists.map(([key]) => ({ key, constName: `${upperSnakeOf(key)}_METHODS`, path: `${kind}/${kebabOf(key)}.ts` }));
}

export function emitEntryMethods(schema: ApiSchema, banner: string): string {
  const entries = aggregate(entryMethods(schema), 'entries');
  const imports = entries.map((item) => `import { ${item.constName} } from './${item.path}';`).join('\n');
  const entryBody = entries.map((item) => `  ${JSON.stringify(item.key)}: ${item.constName},`).join('\n');
  return `${banner}\n${imports}

/** Method names per entry point, sorted; the class sets are in tools/gen/capabilities.ts. */
export const ENTRY_METHODS = {
${entryBody}
} as const;
`;
}

// PRESET_METHODS lives in its own module, so /read-only can import the preset list without the entry lists (plan 10.1 step 2).
export function emitPresetMethods(schema: ApiSchema, banner: string): string {
  const presets = aggregate(presetMethods(schema), 'presets');
  const imports = presets.map((item) => `import { ${item.constName} } from './${item.path}';`).join('\n');
  const presetBody = presets.map((item) => `  ${JSON.stringify(item.key)}: ${item.constName},`).join('\n');
  return `${banner}\n${imports}

/** Method names per named preset. */
export const PRESET_METHODS = {
${presetBody}
} as const;
`;
}
