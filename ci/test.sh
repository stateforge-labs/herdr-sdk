#!/usr/bin/env bash
# test:unit: `bun run test` builds dist first (pretest), then runs every test against the in-process fake herdr. No real herdr, ever.
set -euo pipefail
bun install --frozen-lockfile
bun run test
