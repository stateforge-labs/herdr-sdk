#!/usr/bin/env bash
# ADR-001
set -euo pipefail
# shellcheck source=ci/lib/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_cmd git diff cp

: "${VENDORED_ROOT:=${CI_PROJECT_DIR:-$PWD}}"

check_vendored="$(dirname "${BASH_SOURCE[0]}")/check-vendored.sh"
[ -r "$check_vendored" ] ||
  die "no encuentro '${check_vendored}': vendor-sync.sh vive junto a check-vendored.sh en ci/lib."

# La lista NO se escribe aquí: sale del mismo sitio que check-vendored.sh usa
# para juzgar la copia, así que si esa lista crece este script la sigue solo.
vendored_paths_default() {
  awk -F"VENDORED_PATHS:=" '/VENDORED_PATHS:=/ { sub(/}".*/, "", $2); print $2; exit }' "$check_vendored"
}

: "${VENDORED_PATHS:=$(vendored_paths_default)}"
[ -n "$VENDORED_PATHS" ] ||
  die "no pude leer VENDORED_PATHS de '${check_vendored}'; sin esa lista no sé qué re-vendorizar."

# Sin CI_TEMPLATES_REF en el entorno — el caso normal cuando esto lo dispara
# un postUpgradeTask de Renovate, sin pipeline de por medio — se lee del
# .gitlab-ci.yml del propio consumidor, que Renovate acaba de bumpear: es el
# tag nuevo contra el que hay que sincronizar.
ref_from_gitlab_ci() {
  local gitlab_ci="${VENDORED_ROOT}/.gitlab-ci.yml" ref
  [ -r "$gitlab_ci" ] ||
    die "CI_TEMPLATES_REF no está en el entorno y no puedo leer '${gitlab_ci}' para sacarlo de ahí."
  ref=$(grep -m1 'CI_TEMPLATES_REF:' "$gitlab_ci" | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' || true)
  [ -n "$ref" ] ||
    die "'${gitlab_ci}' no trae un CI_TEMPLATES_REF: vX.Y.Z reconocible."
  printf '%s' "$ref"
}

: "${CI_TEMPLATES_REF:=$(ref_from_gitlab_ci)}"
: "${CI_TEMPLATES_URL:=https://gitlab.example.internal/homelab/ci-templates.git}"

case "$CI_TEMPLATES_REF" in
  v[0-9]*.[0-9]*.[0-9]*) ;;
  *) die "CI_TEMPLATES_REF='${CI_TEMPLATES_REF}' no es un tag vX.Y.Z: 'main' se mueve bajo los pies del consumidor." ;;
esac

reference=$(mktemp -d)
# TERM e INT salen, y con eso pasan por EXIT: una trampa que solo borrara dejaría
# seguir al script sin sus ficheros temporales.
trap 'rm -rf "$reference"' EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

git clone --quiet --depth 1 --branch "$CI_TEMPLATES_REF" "$CI_TEMPLATES_URL" "$reference" ||
  die_undetermined "no pude clonar ${CI_TEMPLATES_URL} en ${CI_TEMPLATES_REF}; sin referencia no re-vendorizo nada."

compared=0
changed=0

for path in $VENDORED_PATHS; do
  remote="${reference}/${path}"
  mine="${VENDORED_ROOT}/${path}"

  [ -e "$remote" ] ||
    die_undetermined "el tag ${CI_TEMPLATES_REF} no trae '${path}': la referencia no es la que se cree."

  if [ ! -e "$mine" ]; then
    printf '  · %s no está vendorizado aquí — nada que sincronizar\n' "$path"
    continue
  fi

  compared=$(( compared + 1 ))
  if diff -rq "$remote" "$mine" >/dev/null 2>&1; then
    printf '  ✓ %s ya coincide con %s\n' "$path" "$CI_TEMPLATES_REF"
    continue
  fi

  rm -rf "$mine"
  mkdir -p "$(dirname "$mine")"
  cp -a "$remote" "$mine"
  changed=$(( changed + 1 ))
  printf '  ↻ %s re-vendorizado desde %s\n' "$path" "$CI_TEMPLATES_REF"
done

[ "$compared" -gt 0 ] ||
  die_undetermined "ninguna ruta de VENDORED_PATHS está vendorizada aquí: nada que sincronizar no es 'todo bien'."

printf 'vendor-sync OK: %d ruta(s) revisadas, %d actualizada(s) a %s@%s\n' \
  "$compared" "$changed" "$CI_TEMPLATES_URL" "$CI_TEMPLATES_REF"
