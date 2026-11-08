# Contributing

Thank you for helping. This file covers how the project takes contributions, how to work in the repository and how a release is made. The [README](README.md) describes the published package only.

## Where things go

| What | Where |
| --- | --- |
| Bug reports, feature requests, questions | [GitHub issues](https://github.com/stateforge-labs/herdr-sdk/issues), using the issue forms |
| Security vulnerabilities | Not an issue: see [SECURITY.md](SECURITY.md) |
| Code and documentation changes | A merge request on the project's GitLab, the source of truth |

The GitHub repository (`stateforge-labs/herdr-sdk`) is a mirror of the GitLab project. Pull requests opened on GitHub are not merged there. If you want to send a change, open an issue first or describe the change in an issue, and a maintainer will bring it into the GitLab project as a merge request. Your commit author is kept.

## Setup

- Bun 1.4.4 (the version in `mise.toml` and the CI files).
- Node 22.18 or later, for the Node tests and the `bin/` scripts.

```sh
bun install --frozen-lockfile
```

Install from the lockfile. Do not add a dependency at runtime: the package has none, and [HERDR-ADR-0015](docs/decisions/HERDR-ADR-0015-dependency-policy-and-size-budget.md) sets the policy for dev dependencies (exact pins, at least 14 days old, checked by `bun run check:pins`).

## Checks

Run what CI runs before you open a merge request. CI is `.github/workflows/ci.yml` on the mirror and the GitLab pipeline on the project.

| Command | What it checks |
| --- | --- |
| `bun run typecheck` | `src/` and `test/` compile (two `tsc` projects) |
| `bun run typecheck:types` | the published types, from `test/types` |
| `bun run lint:layers` | the layer rules in `tools/rules/` |
| `bun run test` | every test, against the in-process fake herdr (`pretest` builds `dist/` first) |
| `bun run test:node` | the wire and connect tests under Node |
| `bun run build` | compiles `dist/` (unbundled ESM and declarations) |
| `bun run check:size` | builds, then enforces the size budget of each entry and the no-leak rule |
| `bash ci/build.sh` | builds the tarball listing and fails if the skill, the API docs or the bins are missing, or if sources or tests are in it |
| `bun run check:pins` | exact pins, at least 14 days old (runs `npm view`, so it needs the public registry) |

No test talks to a real herdr. Tests use `createFakeHerdr()` and `FakeHcCore`.

### Size budget

`bun run check:size` prints the minified size of each consumer scenario against its budget and fails when a row is over budget. Sizes are not kept in the documentation: run the command to see the current numbers.

## Generated code and the schema

`src/herdr/generated/` and `docs/api/` are generated. Do not edit them by hand.

```sh
bun run capture      # herdr api schema --json > schema/herdr-api.schema.json (needs a herdr on PATH)
bun run gen          # regenerates src/herdr/generated and docs/api
herdr-drift          # exit 0 clean, 1 drift, 2 usage, 3 herdr not found
```

`herdr-drift` compares the committed schema with the herdr you have installed. When it reports drift, run `bun run capture` and `bun run gen`, review the diff, and update the tested herdr version in `package.json` (`herdr.testedWith`).

## Repository layout

One folder per product ([HERDR-ADR-0021](docs/decisions/HERDR-ADR-0021-one-folder-per-product.md)); the entry files at the top of `src/` are the published subpaths.

| Folder | What it is |
| --- | --- |
| `src/herdr/` | The herdr server client (protocol 22): `errors.ts` (every error it throws), `wire/`, `client/` (one module per feature: `connect`, `scoped`, `subscribe`, `watch`, `watch-pane-set`, `held`, `long-poll`, and `streams`, loaded on first use), `generated/` (output of `tools/gen/`), `effect/`, `test-kit/` |
| `src/core/` | The herdr-core client (`./core`): `errors.ts` (every failure it returns), `kernel.ts` (its value types), `wire`, `link`, `events`, `backoff`, `constants`; its fake core in `test-kit/` (`./core/test-kit`) |
| `src/drift/` | The schema-drift tool behind `herdr-drift`: `schema`, `diff`, `cli`, `constants`, `types` |
| `test/` | Mirrors `src/` (`test/herdr/`, `test/core/`, `test/drift/`), plus `test/tools/`, `integration/` and `types/` |
| `tools/` | Build time only, never published: `gen/` (the generator), `scripts/` (gates, capture, build helpers), `rules/` (the layer rule) |
| `bin/`, `skills/`, `schema/`, `docs/` | The bins, the agent skill, the captured schema, the docs and decisions |

The architecture notes are in `docs/architecture/` and the decision records in `docs/decisions/`.

## Release

A release is a tag that equals the version in `package.json`.

1. Set `version` in `package.json` and move the `Unreleased` entries in `CHANGELOG.md` under a new heading with the date. Add the compare link at the bottom.
2. Run the checks above.
3. Tag the commit `vX.Y.Z` (for example `v0.3.1`) and push the tag.

The tag starts two publish pipelines. Both stop when the tag and the version differ, and both skip a version their registry already holds:

- GitHub Actions (`.github/workflows/publish.yml`) publishes to npmjs.org with trusted publishing and provenance (see [HERDR-ADR-0022](docs/decisions/HERDR-ADR-0022-publish-to-npm-with-trusted-publishing.md)).
- The GitLab pipeline publishes to the project's GitLab npm registry (see [HERDR-ADR-0019](docs/decisions/HERDR-ADR-0019-publish-to-the-gitlab-npm-registry-on-a-tag.md)).

Packages on npmjs.org published before trusted publishing have no provenance attestation. `npm audit signatures` checks it for the versions that have one.

## Dependency updates

Renovate runs on the project's GitLab only, with `renovate.json`. Its release age is 14 days, the same rule as the pins. Do not add a GitHub dependency bot to the mirror.

## Security checks

GitLab SAST and Secret Detection run in the merge request pipelines of the project. The GitHub mirror does not run a separate CodeQL workflow.

## License

By contributing you agree that your change is released under the MIT licence in [LICENSE](LICENSE).
