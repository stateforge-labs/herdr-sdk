#!/usr/bin/env bash
# ADR-009
set -euo pipefail
# shellcheck source=ci/lib/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

if [ -z "${IMAGE_VERSION_BASE:-}" ]; then
  printf 'semver desactivado: IMAGE_VERSION_BASE no está definida.\n' >&2
  exit 0
fi
require_env IMAGE_REPO VERIFY_TAG

lib=$(dirname "${BASH_SOURCE[0]}")
tag=$("${lib}/image-semver-tag.sh")
NEW_TAG="$tag" "${lib}/registry-add-tag.sh"
VERIFY_TAG="$tag" "${lib}/registry-verify-tag.sh"
"${lib}/flux-notify.sh"
printf 'semver publicado: %s:%s\n' "$IMAGE_REPO" "$tag"
