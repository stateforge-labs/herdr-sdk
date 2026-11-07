#!/usr/bin/env bash
# ADR-093
set -euo pipefail
# shellcheck source=ci/lib/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_env BUILD_CONTEXT BUILD_DOCKERFILE_DIR BUILD_PLATFORMS BUILD_METADATA IMAGE_REF BUILD_PUSH
require_cmd buildctl

case "$BUILD_PUSH" in
  true | false) ;;
  *) die "BUILD_PUSH debe ser 'true' o 'false', no '${BUILD_PUSH}'." ;;
esac

[ -d "$BUILD_CONTEXT" ] || die "BUILD_CONTEXT '${BUILD_CONTEXT}' no es un directorio."
[ -r "${BUILD_DOCKERFILE_DIR}/${BUILD_DOCKERFILE:=Dockerfile}" ] ||
  die "no encuentro ${BUILD_DOCKERFILE_DIR}/${BUILD_DOCKERFILE}."

args=(
  --frontend dockerfile.v0
  --local "context=${BUILD_CONTEXT}"
  --local "dockerfile=${BUILD_DOCKERFILE_DIR}"
  --opt "filename=${BUILD_DOCKERFILE}"
  --opt "platform=${BUILD_PLATFORMS}"
  --metadata-file "${BUILD_METADATA}"
  --output "type=image,name=${IMAGE_REF},push=${BUILD_PUSH}"
)

# ADR-006: inline solo lleva las capas de la imagen final; registry con mode=max lleva
# todas las etapas, y sobrevive al daemon.
case "${BUILD_CACHE_EXPORT:=inline}" in
  inline | registry) ;;
  *) die "BUILD_CACHE_EXPORT debe ser 'inline' o 'registry', no '${BUILD_CACHE_EXPORT}'." ;;
esac

if [ -n "${BUILD_CACHE_REF:-}" ]; then
  args+=(--import-cache "type=registry,ref=${BUILD_CACHE_REF}")
  if [ "$BUILD_PUSH" = "true" ]; then
    if [ "$BUILD_CACHE_EXPORT" = "registry" ]; then
      [ "$BUILD_CACHE_REF" != "$IMAGE_REF" ] || die \
        "BUILD_CACHE_REF e IMAGE_REF son los dos '${IMAGE_REF}': exportar ahi la cache sobreescribe la imagen publicada con un manifiesto de cache. Usa un tag dedicado, p.ej. ':buildcache'."
      args+=(--export-cache "type=registry,ref=${BUILD_CACHE_REF},mode=max")
    else
      args+=(--export-cache "type=inline")
    fi
  fi
fi

# ADR-008
if [ -n "${BUILD_TARGET:-}" ]; then
  grep -qiE "^[[:space:]]*FROM[[:space:]]+.+[[:space:]]+AS[[:space:]]+${BUILD_TARGET}[[:space:]]*$" \
    "${BUILD_DOCKERFILE_DIR}/${BUILD_DOCKERFILE}" ||
    die "BUILD_TARGET '${BUILD_TARGET}' no es una etapa de ${BUILD_DOCKERFILE_DIR}/${BUILD_DOCKERFILE}."
  args+=(--opt "target=${BUILD_TARGET}")
fi

for pair in ${BUILD_ARGS:-}; do
  args+=(--opt "build-arg:${pair}")
done

printf 'buildctl build %s\n' "${args[*]}"
buildctl build "${args[@]}"

[ -s "$BUILD_METADATA" ] || die "buildctl no dejó metadata en ${BUILD_METADATA}: no hay nada que verificar."
