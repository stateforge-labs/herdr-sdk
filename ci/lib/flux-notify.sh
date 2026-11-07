#!/usr/bin/env bash
# ADR-009
set -euo pipefail
# shellcheck source=ci/lib/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

if [ -z "${FLUX_RECEIVER_URL:-}" ]; then
  printf 'sin FLUX_RECEIVER_URL: Flux verá la imagen en el próximo sondeo de su provider.\n' >&2
  exit 0
fi
require_cmd curl

body=""
headers=""
# TERM e INT salen, y con eso pasan por EXIT: una trampa que solo borrara dejaría
# seguir al script sin sus ficheros temporales.
trap 'rm -f "$body" "$headers"' EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
body=$(mktemp)
headers=$(mktemp)

rc=0
curl -q -sS --fail-with-body --connect-timeout 3 --max-time 10 -X POST \
  -D "$headers" -o - "$FLUX_RECEIVER_URL" | head -c 65536 >"$body" || rc=$?
code=$(sed -n 's#^HTTP/[0-9.]* \([0-9][0-9][0-9]\).*#\1#p' "$headers" | tail -n1)
# Y sólo un 2xx es "notificado": un 3xx no es un error para --fail-with-body, pero el receiver
# no lo ha recibido (y curl, con -q y sin -L, no sigue la redirección a ningún otro sitio).
if [ "$rc" -eq 0 ] && [[ "$code" == 2[0-9][0-9] ]]; then
  printf 'Flux notificado.\n' >&2
else
  printf 'AVISO: Flux no aceptó el aviso (HTTP %s, curl salió con %s: %s); la imagen está publicada y el provider la verá en su próximo sondeo.\n' \
    "${code:-000}" "$rc" "$(head -c 200 "$body" | LC_ALL=C tr -c ' -~' '?')" >&2
fi
