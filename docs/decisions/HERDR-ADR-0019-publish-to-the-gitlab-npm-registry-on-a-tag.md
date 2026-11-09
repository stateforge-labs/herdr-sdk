---
id: HERDR-ADR-0019
title: "Publish @homelab/herdr to the GitLab npm registry on a protected tag"
status: superseded
superseded_by: HERDR-ADR-0022
date: 2026-11-07
decision-makers: owner
summary: "Consumers install @homelab/herdr from the homelab GitLab npm registry, not from a vendored tarball. A Maintainers-only v* tag runs the fleet-standard pipeline and publishes with the job token. This diverges from homelab-cli's semantic-release flow on purpose."
---

# HERDR-ADR-0019: Publish to the GitLab npm registry on a protected tag

Supersedes the tarball step of HERDR-ADR-0011 ("tarball, then registry"): the registry step is now.

## Context and problem statement

The hub and herdr-mcp consumed the SDK through checksummed tarballs packed by hand. The owner decided against tarballs: the package is pulled from the GitLab registry. The homelab fleet has a CI standard (homelab/ci-templates, read 2026-11-07: README, `templates/security.yml`, homelab-cli `.gitlab-ci.yml`): tag-pinned templates, vendored `ci/lib` checked against the tag, the canonical `workflow:` block, Harbor-proxied pinned images, stage-scoped job names and shell in files. No homelab project publishes npm today; the one package-registry publisher is homelab-cli (Python): python-semantic-release on `main` with a Maintainer token variable `GITLAB_TOKEN_RELEASE`, then `uv publish`.

## Decision outcome

- Follow the fleet standard for everything the SDK shares with it (see `.gitlab-ci.yml`): `ci-templates` v0.11.0 `security.yml` (`security:deps`, `security:secrets`; the image, manifest and config scanners are switched off because there is no image), vendored `ci/lib` plus `lint:vendored-lib`, the canonical `workflow:` block.
- **Divergence 1, tag-driven release.** The version is the herdr protocol policy (HERDR-ADR-0009: a protocol change or removed API is a major, additions a minor) and is set by hand in `package.json`, not derived from commit messages. A Maintainers-only protected `v*` tag publishes; `ci/check-tag-matches-version.sh` refuses a tag that is not `v<package.json version>`. Withdrawal condition: if the SDK ever adopts conventional commits for version bumps, switch to the homelab-cli semantic-release job and drop this section.
- **Divergence 2, job token.** `npm publish` authenticates with `CI_JOB_TOKEN` against this project's registry (`publish:package`, written to a temporary npmrc, never printed). No release token variable is needed. Withdrawal condition: a registry that rejects the job token.
- Not adopted: the Python contract test (`tests/test_ci_pipeline_shape.py`) and `lint:ci-image`: the SDK is TypeScript, builds no CI image, and the contract has no non-Python runner. The standard's own handbook pointer for non-Python repos is dead (delivery-handbook ADR 0105), so this gap is recorded, not closed.
- Consumers (hub, herdr-mcp) set `@homelab` to the registry in their `bunfig.toml` with a read token from an environment variable, and list the package name `@stateforge-labs/herdr-sdk` in `minimumReleaseAgeExcludes`: our own scope is exempt from the 14-day release age (HERDR-ADR-0015, amended 2026-11-08). Bun matches names only, so each own package is listed by name. The vendored tarballs are deleted.

## Consequences

- Good: one source of truth, no checksums to maintain, publishing is auditable (tag, pipeline, package).
- Bad: installs need a read token (private project); a fresh release is blocked by the 14-day gate until excluded (from 2026-11-08 the own `@stateforge-labs` scope is exempt from the age, see HERDR-ADR-0015); CI image names (Harbor proxy) are assumed from other repos until the first pipeline runs.
- Open: whether the group-level registry endpoint should replace the project-level URL when more `@homelab` packages exist.
