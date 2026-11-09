#!/usr/bin/env bash
# lint:typecheck: install from the lockfile, then the two tsc projects (src and tests) and the layer rules.
set -euo pipefail
bun install --frozen-lockfile
bun run typecheck
bun run lint:layers
# check:pins (the 14-day release-age gate; our own @stateforge-labs scope is exempt from the age) runs `npm view` against the public registry: the bun image has no npm and the
# runners need not reach it. It stays a local delivery gate (mise task), as in HERDR-ADR-0015.
