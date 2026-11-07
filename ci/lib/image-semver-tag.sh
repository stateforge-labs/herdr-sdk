#!/usr/bin/env bash
# ADR-009
set -euo pipefail
# shellcheck source=ci/lib/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_env IMAGE_VERSION_BASE CI_PIPELINE_IID

[[ "$IMAGE_VERSION_BASE" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] ||
  die "IMAGE_VERSION_BASE debe ser MAJOR.MINOR sin ceros a la izquierda (leído: '${IMAGE_VERSION_BASE}')."
[[ "$CI_PIPELINE_IID" =~ ^[1-9][0-9]*$ ]] ||
  die "CI_PIPELINE_IID no es un entero positivo (leído: '${CI_PIPELINE_IID}')."

tag="${IMAGE_VERSION_BASE}.${CI_PIPELINE_IID}"
if [ -n "${IMAGE_SEMVER_PRERELEASE:-}" ]; then
  [[ "$IMAGE_SEMVER_PRERELEASE" =~ ^[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*$ ]] ||
    die "IMAGE_SEMVER_PRERELEASE no es un identificador semver válido (leído: '${IMAGE_SEMVER_PRERELEASE}')."
  tag="${tag}-${IMAGE_SEMVER_PRERELEASE}"
fi
printf '%s\n' "$tag"
