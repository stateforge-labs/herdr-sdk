---
id: HERDR-ADR-0022
title: "Publish @stateforge-labs/herdr to npm with trusted publishing"
status: accepted
date: 2026-11-08
decision-makers: owner
supersedes: HERDR-ADR-0019
summary: "The package moves from the private GitLab npm registry to the public npm registry as @stateforge-labs/herdr. Releases run from GitHub Actions (github.com/stateforge-labs/herdr-sdk) with npm trusted publishing (OIDC): no npm token is stored, and every version carries a provenance attestation."
---

# HERDR-ADR-0022: Publish to npm with trusted publishing

## Context and problem statement

HERDR-ADR-0019 published `@homelab/herdr` to a private GitLab npm registry on a protected tag. Consumers outside that network (the
public herdr-plugins repository, its users) cannot install from it, and a plugin's `npm ci` would need a token. npm trusted
publishing exchanges a CI OIDC token for a short-lived publish credential; it supports GitHub Actions and GitLab.com, not a
self-hosted GitLab (https://docs.npmjs.com/trusted-publishers, read 2026-11-08).

## Decision

- The package is `@stateforge-labs/herdr` on https://registry.npmjs.org, public (`publishConfig.access`).
- The public repository is https://github.com/stateforge-labs/herdr-sdk. `.github/workflows/publish.yml` runs on a `v*.*.*` tag:
  it checks that the tag equals the `package.json` version, runs the typecheck, the layer gate, the Bun and Node tests, the size gate
  and the tarball check, then `npm publish` with OIDC (`id-token: write`, npm 11.5.1 or later). Provenance is attached automatically.
- On npmjs.com the package has one trusted publisher (GitHub Actions, `stateforge-labs/herdr-sdk`, `publish.yml`) and publishing
  access "require two-factor authentication and disallow tokens".
- The very first version (0.3.0) is published by hand by the owner, `npm publish --provenance=false` after `npm login`: the trusted
  publisher is set on the package's settings page, so the package must exist first, and provenance needs CI. No `v0.3.0` tag is
  pushed (the workflow would fail on an existing version); 0.3.1 is the first release through the workflow, with provenance.
- `.github/workflows/ci.yml` runs the same checks on every push to main and every pull request.

## Consequences

- Installing needs no `.npmrc`, no token and no scope registry entry: `npm install @stateforge-labs/herdr`.
- Provenance links each version to its commit and workflow run; it needs the repository to stay public.
- The GitLab pipeline no longer publishes (its registry job belongs to HERDR-ADR-0019).
