#!/usr/bin/env bash
# publish:package: publish the already-built package to this project's GitLab npm registry with the job token.
# dist/ comes from build:package, so lifecycle scripts are skipped (the node image has no bun).
# The registry login is written to a temporary npmrc outside the checkout and removed on exit; the token is never printed.
set -euo pipefail
# shellcheck source=ci/lib/common.sh
. "${CI_PROJECT_DIR:-.}/ci/lib/common.sh"

require_env CI_JOB_TOKEN CI_SERVER_HOST CI_PROJECT_ID CI_API_V4_URL
require_cmd npm node

bash "${CI_PROJECT_DIR:-.}/ci/check-tag-matches-version.sh"
[ -f dist/index.js ] || die "dist/ is missing: build:package must run first."

npmrc="$(mktemp)"
trap 'rm -f "${npmrc}"' EXIT
registry="${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages/npm/"
{
  printf '@homelab:registry=%s\n' "${registry}"
  printf '//%s/api/v4/projects/%s/packages/npm/:_authToken=%s\n' "${CI_SERVER_HOST}" "${CI_PROJECT_ID}" "${CI_JOB_TOKEN}"
} > "${npmrc}"

npm publish --ignore-scripts --userconfig "${npmrc}"
