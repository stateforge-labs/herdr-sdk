#!/usr/bin/env bash
# lint:typecheck: install from the lockfile, then the two tsc projects (src and tests).
set -euo pipefail
bun install --frozen-lockfile
bun run typecheck
bun run lint:layers
bun run check:pins
