#!/usr/bin/env bash
# ADR-009
set -euo pipefail
# Con set -x (CI_DEBUG_TRACE, `bash -x`, SHELLOPTS=xtrace) bash traza argumentos y asignaciones,
# contraseña y token incluidos. Este script no se traza: lo que haga falta depurar lo dicen sus
# mensajes.
{ set +x; } 2>/dev/null
# shellcheck source=ci/lib/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_env HARBOR_HOST HARBOR_USERNAME HARBOR_PASSWORD IMAGE_REPO VERIFY_TAG NEW_TAG
require_cmd curl sed tr grep sha256sum cut

# Se retaguea el digest que esta build verificó, no lo que VERIFY_TAG resuelva ahora:
# un tag se mueve, y entre la verificación y el PUT podría apuntar a otra cosa.
verified_digest() {
  local digest="${EXPECTED_DIGEST:-}"
  if [ -z "$digest" ]; then
    [ -s "${BUILD_METADATA:-}" ] ||
      die "sin EXPECTED_DIGEST ni BUILD_METADATA: no hay digest verificado que retaguear como ${NEW_TAG}."
    digest=$(json_get "$BUILD_METADATA" containerimage.digest) ||
      die "${BUILD_METADATA} no es JSON parseable."
  fi
  is_sha256_digest "$digest" ||
    die "el digest verificado no es sha256:<64 hex> (leído: '${digest}'): no retagueo a ciegas."
  printf '%s' "$digest"
}

manifest=""
headers=""
body=""
trap 'rm -f "$manifest" "$headers" "$body"' EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
manifest=$(mktemp)
headers=$(mktemp)
body=$(mktemp)

digest=$(verified_digest)
token=$(registry_token pull,push "$body")
auth=$(curl_config header "Authorization: Bearer ${token}")

# Cada curl con -w guarda su código de salida (transport_ok, en common.sh) en vez de cortar el
# script bajo set -e sin decir qué no se pudo hacer.
rc=0
code=$(printf '%s\n' "$auth" | curl -q -sS -K - -o "$manifest" -D "$headers" -w '%{http_code}' \
  -H 'Accept: application/vnd.oci.image.index.v1+json' \
  -H 'Accept: application/vnd.oci.image.manifest.v1+json' \
  -H 'Accept: application/vnd.docker.distribution.manifest.list.v2+json' \
  -H 'Accept: application/vnd.docker.distribution.manifest.v2+json' \
  "https://${HARBOR_HOST}/v2/${IMAGE_REPO}/manifests/${digest}") || rc=$?
transport_ok "$rc" "$code" "pedir ${IMAGE_REPO}@${digest}"
case "$code" in
  200) ;;
  *) die "Harbor no sirve ${IMAGE_REPO}@${digest} para retaguearlo — HTTP ${code}." ;;
esac

found="sha256:$(sha256sum <"$manifest" | cut -d' ' -f1)"
[ "$found" = "$digest" ] ||
  die "Harbor sirvió para ${IMAGE_REPO}@${digest} unos bytes que hashean ${found}: no los publico como ${NEW_TAG}."
header=$(tr -d '\r' <"$headers" | sed -n 's/^[Dd]ocker-[Cc]ontent-[Dd]igest: *//p' | tail -n1)
[ -z "$header" ] || [ "$header" = "$digest" ] ||
  die "Docker-Content-Digest dice ${header} para ${IMAGE_REPO}@${digest}: no lo publico como ${NEW_TAG}."

media=$(tr -d '\r' <"$headers" | sed -n 's/^[Cc]ontent-[Tt]ype: *//p' | tail -n1)
[ -n "$media" ] || die "${IMAGE_REPO}@${digest} respondió sin Content-Type: no sé con qué tipo volver a subirlo."

# Un tag semver es MAJOR.MINOR.<IID>: si ya existe es de un intento anterior de esta misma
# pipeline. Al mismo digest, el trabajo ya está hecho; a otro, el PUT lo repuntaría en
# silencio y quien ya lo desplegó correría otra imagen con el mismo nombre. Entre este HEAD y
# el PUT queda una ventana; cerrarla del todo es cosa de una regla de inmutabilidad en Harbor.
rc=0
code=$(printf '%s\n' "$auth" | curl -q -sS -K - -I -o /dev/null -D "$headers" -w '%{http_code}' \
  -H 'Accept: application/vnd.oci.image.index.v1+json' \
  -H 'Accept: application/vnd.oci.image.manifest.v1+json' \
  -H 'Accept: application/vnd.docker.distribution.manifest.list.v2+json' \
  -H 'Accept: application/vnd.docker.distribution.manifest.v2+json' \
  "https://${HARBOR_HOST}/v2/${IMAGE_REPO}/manifests/${NEW_TAG}") || rc=$?
transport_ok "$rc" "$code" "comprobar si ${IMAGE_REPO}:${NEW_TAG} ya existe"
case "$code" in
  404) ;;
  200)
    existing=$(tr -d '\r' <"$headers" | sed -n 's/^[Dd]ocker-[Cc]ontent-[Dd]igest: *//p' | tail -n1)
    [ -n "$existing" ] ||
      die "${IMAGE_REPO}:${NEW_TAG} ya existe y Harbor no dice a qué digest apunta: no lo sobrescribo a ciegas."
    if [ "$existing" = "$digest" ]; then
      printf 'ya etiquetado: %s@%s -> %s\n' "$IMAGE_REPO" "$digest" "$NEW_TAG"
      exit 0
    fi
    die "${IMAGE_REPO}:${NEW_TAG} ya existe y apunta a ${existing}, no a ${digest}: no lo repunto. Es de un intento anterior de esta pipeline; lanza una pipeline nueva para un IID nuevo." ;;
  *) die "no pude comprobar si ${IMAGE_REPO}:${NEW_TAG} ya existe — HTTP ${code}." ;;
esac

rc=0
code=$(printf '%s\n' "$auth" | curl -q -sS -K - -o /dev/null -w '%{http_code}' -X PUT \
  -H "Content-Type: ${media}" \
  --data-binary "@${manifest}" \
  "https://${HARBOR_HOST}/v2/${IMAGE_REPO}/manifests/${NEW_TAG}") || rc=$?
transport_ok "$rc" "$code" "subir ${IMAGE_REPO}:${NEW_TAG} (reintentar es seguro: el HEAD lo verá si llegó)"
case "$code" in
  201) ;;
  *) die "Harbor no aceptó ${IMAGE_REPO}:${NEW_TAG} — HTTP ${code}." ;;
esac

printf 'etiquetado: %s@%s -> %s\n' "$IMAGE_REPO" "$digest" "$NEW_TAG"
