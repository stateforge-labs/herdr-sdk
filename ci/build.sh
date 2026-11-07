#!/usr/bin/env bash
# build:package: compile dist/ and check what the tarball would contain: the skill, the generated API docs and the bins must be in it, the sources and tests must not.
set -euo pipefail
bun install --frozen-lockfile
bun run build
listing="$(bun pm pack --dry-run 2>&1)"
printf '%s\n' "${listing}"
for must in skills/herdr-sdk/SKILL.md docs/api/methods.md bin/herdr-drift.js bin/herdr-skill.js dist/index.js; do
  printf '%s\n' "${listing}" | grep -q "${must}" || { printf 'FATAL: %s is not in the package\n' "${must}" >&2; exit 1; }
done
if printf '%s\n' "${listing}" | grep -Eq '(^|[[:space:]])(src|test|gen)/'; then
  printf 'FATAL: sources or tests are in the package\n' >&2
  exit 1
fi
