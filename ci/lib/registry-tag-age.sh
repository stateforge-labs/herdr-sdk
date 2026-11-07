#!/usr/bin/env bash
# ADR-093
set -euo pipefail
# Con set -x (CI_DEBUG_TRACE, `bash -x`, SHELLOPTS=xtrace) bash traza argumentos, contraseña
# incluida. Este script no se traza: lo que haga falta depurar lo dicen sus mensajes.
{ set +x; } 2>/dev/null
# shellcheck source=ci/lib/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_env HARBOR_HOST HARBOR_USERNAME HARBOR_PASSWORD IMAGE_REPO AGE_TAG
require_cmd curl python3

project="${IMAGE_REPO%%/*}"
repository="${IMAGE_REPO#*/}"
[ "$project" != "$IMAGE_REPO" ] ||
  die "IMAGE_REPO='${IMAGE_REPO}' debe ser <proyecto>/<repositorio>."

body=$(mktemp)
# TERM e INT salen, y con eso pasan por EXIT: una trampa que solo borrara dejaría
# seguir al script sin sus ficheros temporales.
trap 'rm -f "$body"' EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

# Usuario y contraseña van por stdin (`-K -`), no en argv.
rc=0
code=$(curl_config user "${HARBOR_USERNAME}:${HARBOR_PASSWORD}" |
  curl -q -sS -K - -o "$body" -w '%{http_code}' \
    --get --data-urlencode "q=tags=${AGE_TAG}" --data-urlencode 'page_size=1' \
    "https://${HARBOR_HOST}/api/v2.0/projects/${project}/repositories/${repository//\//%252F}/artifacts") || rc=$?
transport_ok "$rc" "$code" "preguntar por ${IMAGE_REPO}:${AGE_TAG}"

[ "$code" = "200" ] ||
  die "$(printf 'Harbor respondió %s al preguntar por %s:%s\n  %s' "$code" "$IMAGE_REPO" "$AGE_TAG" "$(head -c 300 "$body")")"

python3 - "$body" "$AGE_TAG" <<'PY'
import datetime, json, sys

with open(sys.argv[1]) as fh:
    artifacts = json.load(fh)
if not isinstance(artifacts, list) or not artifacts:
    raise SystemExit(f"Harbor no devolvió ningún artefacto con el tag {sys.argv[2]}")
stamp = artifacts[0].get("push_time")
if not stamp:
    raise SystemExit("el artefacto no trae push_time; no puedo calcular su edad")
stamp = stamp.replace("Z", "+00:00")
if "." in stamp:
    head, rest = stamp.split(".", 1)
    frac, _, tz = rest.partition("+")
    stamp = f"{head}.{frac[:6]}+{tz}" if tz else f"{head}.{frac[:6]}"
pushed = datetime.datetime.fromisoformat(stamp)
now = datetime.datetime.now(datetime.timezone.utc)
print(int(max((now - pushed).total_seconds(), 0) // 3600))
PY
