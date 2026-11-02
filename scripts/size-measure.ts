// Role: measures one bundle for the size gate: bytes of the static closure of an entry, bytes of its lazy chunks, the inputs that contributed, and whether child_process was emitted.
// Pure readers of a bun metafile are exported for tests; `measureEntry` is the only I/O (one `bun build` into a temporary directory).
// Informs plan 10.1 and HERDR-ADR-0015 (budgets measured on dist/ with --splitting).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SIZE_MAX_BUFFER_BYTES,
  SizeBuildArg,
  SizeForbidden,
  SizeImportKind,
  SizeTemp,
} from './size-constants.ts';

// The part of a bun metafile this file reads.
export interface MetaOutput {
  readonly bytes: number;
  readonly entryPoint?: string;
  readonly imports: readonly { readonly path: string; readonly kind: string }[];
  readonly inputs: Readonly<Record<string, unknown>>;
}

export interface Meta {
  readonly outputs: Readonly<Record<string, MetaOutput>>;
}

export interface Measurement {
  readonly bytes: number;
  readonly lazyBytes: number;
  readonly inputs: readonly string[];
  readonly emitted: string;
}

// Pure: the output files reached from the entry through static imports only (the bytes a consumer loads at start).
// bun also gives a chunk that only a dynamic import() reaches an entryPoint, so the roots are the entry outputs that no dynamic import targets.
export function staticClosure(meta: Meta): Set<string> {
  const dynamicTargets = new Set(
    Object.values(meta.outputs).flatMap((output) =>
      output.imports.filter((edge) => edge.kind === SizeImportKind.Dynamic).map((edge) => edge.path),
    ),
  );
  const entries = Object.keys(meta.outputs).filter(
    (key) => meta.outputs[key]?.entryPoint !== undefined && !dynamicTargets.has(key),
  );
  const closure = new Set<string>();
  const pending = [...entries];
  while (pending.length > 0) {
    const key = pending.pop();
    if (key === undefined || closure.has(key)) {
      continue;
    }
    closure.add(key);
    for (const edge of meta.outputs[key]?.imports ?? []) {
      if (edge.kind === SizeImportKind.Static && meta.outputs[edge.path] !== undefined) {
        pending.push(edge.path);
      }
    }
  }
  return closure;
}

// Pure: the bytes of the static closure, the bytes of every other output (lazy chunks), and the distinct input paths of all outputs.
export function measureMeta(meta: Meta): Pick<Measurement, 'bytes' | 'lazyBytes' | 'inputs'> {
  const closure = staticClosure(meta);
  let bytes = 0;
  let lazyBytes = 0;
  const inputs = new Set<string>();
  for (const [key, output] of Object.entries(meta.outputs)) {
    if (closure.has(key)) {
      bytes += output.bytes;
    } else {
      lazyBytes += output.bytes;
    }
    for (const input of Object.keys(output.inputs)) {
      inputs.add(input);
    }
  }
  return { bytes, lazyBytes, inputs: [...inputs].sort() };
}

// Pure: the inputs that contain one of the forbidden fragments.
export function leakedInputs(inputs: readonly string[], forbidden: readonly string[]): string[] {
  return inputs.filter((input) => forbidden.some((fragment) => input.includes(fragment)));
}

// Pure: the forbidden fragments that appear in emitted text (used for the child_process import, which is external and has no input path).
export function leakedText(text: string, forbidden: readonly string[]): string[] {
  return forbidden.filter((fragment) => text.includes(fragment));
}

// The fragments a production row or a scenario must not contain (plan 10.1); TestKit, TestData, DriftData, MethodTable, EntryMethods and ChildProcess apply everywhere.
export const ALWAYS_FORBIDDEN: readonly string[] = [
  SizeForbidden.TestKit,
  SizeForbidden.TestData,
  SizeForbidden.DriftData,
  SizeForbidden.MethodTable,
  SizeForbidden.EntryMethods,
];

function emittedText(dir: string): string {
  return readdirSync(dir)
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile())
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
}

// Builds one entry (already a real file) with --splitting and the metafile, and measures it. Throws when bun writes an error.
export function measureEntry(entryPath: string, bunPath: string): Measurement {
  const dir = mkdtempSync(join(tmpdir(), SizeTemp.DirPrefix));
  try {
    const outDir = join(dir, SizeTemp.OutDir);
    const metafile = join(dir, SizeTemp.Meta);
    execFileSync(
      bunPath,
      [
        SizeBuildArg.Build,
        entryPath,
        SizeBuildArg.Minify,
        SizeBuildArg.Target,
        SizeBuildArg.TargetNode,
        SizeBuildArg.External,
        SizeBuildArg.Effect,
        SizeBuildArg.Splitting,
        SizeBuildArg.Outdir,
        outDir,
        `${SizeBuildArg.Metafile}=${metafile}`,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: SIZE_MAX_BUFFER_BYTES },
    );
    const meta = JSON.parse(readFileSync(metafile, 'utf8')) as Meta;
    const measured = measureMeta(meta);
    return { ...measured, emitted: emittedText(outDir) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
