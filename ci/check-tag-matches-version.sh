#!/usr/bin/env bash
# publish:package guard: the tag must be v<version> of package.json, so a tag can never publish another version than the one it names.
set -euo pipefail
# shellcheck source=ci/lib/common.sh
. "${CI_PROJECT_DIR:-.}/ci/lib/common.sh"

require_env CI_COMMIT_TAG
require_cmd node

version="$(node -p "require('./package.json').version")"
[ "${CI_COMMIT_TAG}" = "v${version}" ] ||
  die "tag ${CI_COMMIT_TAG} does not match package.json version ${version}: nothing is published."
printf 'tag %s matches package.json %s\n' "${CI_COMMIT_TAG}" "${version}"
