# Provenance of `tools/gen/`, `src/herdr/generated/` and the schema

`@homelab/herdr` is built on a **port of a third party's generator**, not on our own original work.
The chain below is complete from the upstream project to this package. Licence text: [LICENSE](LICENSE).

| | |
| --- | --- |
| Upstream | `https://github.com/brooswit-factory/jsHerdrSDK`, commit `e34fd3f2cf32722ed570d1c232c35bdd83eef312` (2026-08-26), paths `scripts/gen/` and `src/` |
| Published as | `@brooswit/herdr-sdk` 0.1.3 on npm. **Not depended on** by this package |
| Licence | MIT, declared in the upstream `package.json`. The upstream repository has no LICENSE file (open question 2 in the plan) |
| Author | brooswit `<brooswit@gmail.com>` |

## 1. Intermediate port: atalaya-bridge

`~/src/delivery-handbook/atalaya-bridge` (local checkout), commit `097adfd662c4818a351c714e4863c1d606726822`.
Its changes to upstream, as stated in atalaya's own `NOTICE.md`:

1. `Bun.file(path).text()` replaced by `readFileSync(path, 'utf8')`.
2. `.js` import specifiers replaced by `.ts`.
3. `JSONSchema` is a real recursive interface instead of `Record<string, any>`.
4. The regular-expression `typeName` scan is a character scan.

## 2. Owner's repairs carried into this package

From the hub vendor NOTICE (`plugins/crisap94.voice-engine/hub/src/shared/vendor/atalaya/NOTICE.md`).
These land in the runtime client in phase 2a:

1. `Connection.destroy()` (hard teardown beside `close()`).
2. `rpc` takes `signal`, destroys the connection on every settle, and rejects a non-object reply.

## 3. Changes in this package

| File | Change |
| --- | --- |
| `tools/gen/schema.ts` | Path parameter: `loadSchema(path)` (atalaya read a fixed `SCHEMA_PATH`); `GEN_PATHS` replaces atalaya's `ROOT`, `SCHEMA_PATH` and `OUT_DIR`, and points the output at `src/generated/`. `#gen/*` alias dropped. `constOf` checks its value through an `isString` type guard (TypeScript 7 narrows `typeof` only against a literal, so the P0 form failed `bun run typecheck`). Names (`JS_TYPE`, `SCHEMA_KEY`, `SCHEMA_NAMESPACE`) are `as const` objects. `JSONSchema` gains `default`, `format`, `pattern` and `propertyNames`, for the doc comments. `requestNamespace()` added. The generated header ends "Do not edit." (ASCII full stop, no em dash). |
| `tools/gen/json-type.ts` | New file, no counterpart in atalaya 097adfd. Holds `JSON_TYPE` and `FORMAT` as `as const` objects and `kindsOf()`, which atalaya kept inline in `ts-type.ts` and compared against string literals. |
| `tools/gen/doc-comment.ts` | New file, no counterpart in atalaya 097adfd. Builds one-line JSDoc from `description`, `default` (`@default`), `propertyNames.pattern` (`keys match`) and `format: uint64`, which atalaya did not emit. Also fixes atalaya's unescaped `*/` in `emitDefs`: `*/` becomes `* /` and line breaks fold to spaces, for every doc, not only field docs. |
| `tools/gen/ts-type.ts` | Imports use `./` with `.ts` (`#gen/*` alias dropped). Literal comparisons (`kind === 'string'` and the like) replaced by a `switch` on `JSON_TYPE`; output spellings and separators are named constants. `kindsOf` moved to `json-type.ts`. Field and `$defs` docs go through `schemaDoc()`. The map test for `additionalProperties` is `isSchemaMap` (object, not null). |
| `tools/gen/merge-defs.ts` | New file, no counterpart in atalaya 097adfd. Replaces atalaya's hard-coded `SHARED` set in `emit-events.ts` (`AgentStatus`, `PaneScrollInfo`). `mergeDefinitions()` emits a `$def` that several bundles repeat once when the definitions are structurally equal after `$ref` normalisation and key sorting, and throws on a conflict. |
| `tools/gen/emit-params.ts` | `METHODS` and `Method` moved out to `emit-method-table.ts`; imports `Method` from `./methods.ts`. Adds `MethodParamsCheck`, which fails to compile when a method has no params entry. Bundle and key names from `SCHEMA_NAMESPACE` and `SCHEMA_KEY`, not literals. |
| `tools/gen/emit-results.ts` | Names (`success_response`, `ResponseResult`, the `Result_` prefix, the `type` key) come from constants. `METHOD_RESULT` is built from the seed by `methodResultTags()` (method to tag only) and checked with `satisfies Partial<Record<Method, ResultTag>>`, where atalaya imported the record. Imports `Method` from `./methods.ts`. |
| `tools/gen/emit-errors.ts` | Bundle name from `SCHEMA_NAMESPACE.errorResponse` (atalaya used the literal `'error_response'`). Otherwise as atalaya. |
| `tools/gen/emit-events.ts` | `SHARED` set removed; `mergeDefinitions()` over the `event` and `subscription_event` bundles replaces it, emitting all definitions in one block (atalaya emitted two blocks with section comments). Bundle names from `SCHEMA_NAMESPACE`. |
| `tools/gen/emit-index.ts` | New file, no counterpart in atalaya 097adfd. Holds the `index.ts` text that atalaya's `gen/index.ts` inlined. Re-exports `METHODS` and `Method` from `./methods.ts` rather than `./params.ts`. |
| `tools/gen/emit-method-table.ts` | New file, no counterpart in atalaya 097adfd. Emits `METHODS` as `{ name, ns }` rows (namespace path split from the dotted name; duplicate names refused) and `Method` derived from it. The class and result columns arrive in phases 1b and 3. |
| `tools/gen/method-result-map.ts` | The 25 atalaya rows are the seed as `METHOD_RESULT_SEED`; each row carries a `source` (`RESULT_SOURCE`, all `seed` today). `methodResultTags()` projects them to method to tag. The 25 mappings are unchanged. |
| `tools/gen/index.ts` | Writes its modules into `src/herdr/generated/` (nested `names/`, `entries/`, `presets/`, `test-data/` since the 2026-11-02 build split), keyed by `renderOutputs()`. Atalaya wrote five into `generated/`, with the index text inline. Bodies come from `renderOutputs()`; `runGenerator({ schemaPath, outDir })` takes paths; the CLI runs under `import.meta.main`. |
| `package.json` | Version `0.2.0`; `herdr` block (protocol 22, schemaVersion 1, testedWith 0.9.5); scripts `capture`, `test:gen`, `check:pins`, `typecheck`; dev pins `@types/node` 22.20.5 and `typescript` 7.0.2 (exact, released at least 14 days before adoption, see HERDR-ADR-0015). |
| `tsconfig.json` | New. Strict set from atalaya, `nodenext`, `erasableSyntaxOnly`; includes `gen`, `scripts`, `src`; `test/` excluded until `@types/bun` is adopted. |
| `tools/scripts/check-pins.ts` | New. Pin gate (exact version, released at least 14 days ago, via `npm view <pkg> time`). |
| `tools/scripts/capture-schema.ts` | New. Captures `herdr api schema --json` and `herdr --version` into `schema/`. |
| `LICENSE`, `NOTICE.md`, `.gitignore` | New. MIT licence, this provenance, ignores `node_modules/` and `dist/`. |
