#!/usr/bin/env bash
# publish:gitlab: publish the already-built package to this project's GitLab npm registry with the job token, so CI
# pipelines on this GitLab can install it without leaving the network. npmjs.org is published from GitHub Actions on
# the same tag (HERDR-ADR-0022); both skip a version their registry already holds, so re-running a tag is harmless.
# dist/ comes from build:package, so lifecycle scripts are skipped (the node image has no bun).
# publishConfig names npmjs.org and provenance, which do not apply here, so they are removed from this job's copy of
# package.json only. The registry login is a temporary npmrc outside the checkout; the token is never printed.
set -euo pipefail
# shellcheck source=ci/lib/common.sh
. "${CI_PROJECT_DIR:-.}/ci/lib/common.sh"

require_env CI_JOB_TOKEN CI_PROJECT_ID CI_API_V4_URL
require_cmd npm node

bash "${CI_PROJECT_DIR:-.}/ci/check-tag-matches-version.sh"
[ -f dist/index.js ] || die "dist/ is missing: build:package must run first."

name="$(node -p "require('./package.json').name")"
version="$(node -p "require('./package.json').version")"
scope="${name%%/*}"
registry="${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages/npm/"

npmrc="$(mktemp)"
trap 'rm -f "${npmrc}"' EXIT
{
  printf '%s:registry=%s\n' "${scope}" "${registry}"
  printf '%s:_authToken=%s\n' "${registry#https:}" "${CI_JOB_TOKEN}"
} > "${npmrc}"

errors="$(mktemp)"
trap 'rm -f "${npmrc}" "${errors}"' EXIT
if seen="$(npm view "${name}@${version}" version --userconfig "${npmrc}" 2>"${errors}")"; then
  if [ "${seen}" = "${version}" ]; then
    printf '%s@%s is already in the GitLab registry: nothing to publish\n' "${name}" "${version}"
    exit 0
  fi
elif ! grep -q 'E404' "${errors}"; then
  die "could not ask the GitLab registry for ${name}@${version}: $(cat "${errors}")"
fi

npm pkg delete publishConfig.registry publishConfig.provenance
npm publish --ignore-scripts --userconfig "${npmrc}"
printf 'published %s@%s to %s\n' "${name}" "${version}" "${registry}"
