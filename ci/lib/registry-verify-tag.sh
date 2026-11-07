#!/usr/bin/env bash
# ADR-093
set -euo pipefail
# Con set -x (CI_DEBUG_TRACE, `bash -x`, SHELLOPTS=xtrace) bash traza argumentos y asignaciones,
# contraseña y token incluidos. Este script no se traza: lo que haga falta depurar lo dicen sus
# mensajes.
{ set +x; } 2>/dev/null
# shellcheck source=ci/lib/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_env HARBOR_HOST HARBOR_USERNAME HARBOR_PASSWORD IMAGE_REPO VERIFY_TAG
require_cmd curl sha256sum sed tr

built_digest() {
  local digest
  [ -s "${BUILD_METADATA:-}" ] || die "BUILD_METADATA ausente o vacío: buildctl no dijo qué exportó."
  digest=$(json_get "$BUILD_METADATA" containerimage.digest) ||
    die "${BUILD_METADATA} no es JSON parseable."
  is_sha256_digest "$digest" ||
    die "sin containerimage.digest sha256:<64 hex> en ${BUILD_METADATA} (leído: '${digest}')."
  printf '%s' "$digest"
}

expected="${EXPECTED_DIGEST:-}"
if [ -z "$expected" ] && [ -n "${BUILD_METADATA:-}" ]; then
  expected=$(built_digest)
fi
[ -z "$expected" ] || is_sha256_digest "$expected" ||
  die "EXPECTED_DIGEST no es sha256:<64 hex> (leído: '${expected}')."

# Antes de pedir nada, y del proceso principal: registry_token corre en un subshell, y si
# cancelan el job mientras pide el token, solo esta trampa limpia. TERM e INT salen, y con eso
# pasan por EXIT: una trampa que solo borrara dejaría seguir al script sin sus ficheros.
body=$(mktemp)
headers=$(mktemp)
token_body=$(mktemp)
trap 'rm -f "$body" "$headers" "$token_body"' EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

token=$(registry_token pull "$token_body")

rc=0
code=$(curl_config header "Authorization: Bearer ${token}" |
  curl -q -sS -K - -o "$body" -D "$headers" -w '%{http_code}' \
    -H 'Accept: application/vnd.oci.image.index.v1+json' \
    -H 'Accept: application/vnd.oci.image.manifest.v1+json' \
    -H 'Accept: application/vnd.docker.distribution.manifest.list.v2+json' \
    -H 'Accept: application/vnd.docker.distribution.manifest.v2+json' \
    "https://${HARBOR_HOST}/v2/${IMAGE_REPO}/manifests/${VERIFY_TAG}") || rc=$?
transport_ok "$rc" "$code" "pedir ${IMAGE_REPO}:${VERIFY_TAG}"

[ "$code" = "200" ] || die "$(printf 'Harbor no sirve %s:%s — HTTP %s\n  esperado: %s\n  cuerpo: %s' \
  "$IMAGE_REPO" "$VERIFY_TAG" "$code" "${expected:-<cualquiera>}" "$(head -c 400 "$body")")"

json_get "$body" mediaType >/dev/null ||
  die "${IMAGE_REPO}:${VERIFY_TAG} respondió 200 con algo que no es JSON: $(head -c 200 "$body")"

grep -q '"layers"\|"manifests"' "$body" ||
  die "${IMAGE_REPO}:${VERIFY_TAG} devolvió JSON que no es un manifest: $(head -c 200 "$body")"

found="sha256:$(sha256sum <"$body" | cut -d' ' -f1)"
header=$(tr -d '\r' <"$headers" | sed -n 's/^[Dd]ocker-[Cc]ontent-[Dd]igest: *//p' | tail -n1)

if [ -n "$header" ] && [ "$header" != "$found" ]; then
  die "el registro dice ${header} y los bytes servidos hashean ${found}."
fi
if [ -n "$expected" ] && [ "$expected" != "$found" ]; then
  die "${IMAGE_REPO}:${VERIFY_TAG} sirve ${found}, no el ${expected} que esta build exportó."
fi

printf 'verificado: %s:%s = %s\n' "$IMAGE_REPO" "$VERIFY_TAG" "$found"
