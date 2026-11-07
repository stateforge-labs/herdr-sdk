#!/usr/bin/env bash
# ADR-093
set -euo pipefail
# Con set -x (CI_DEBUG_TRACE, `bash -x`, SHELLOPTS=xtrace) bash traza los argumentos de
# write_registry_auth, contraseña incluida. Este script no se traza: lo que haga falta depurar
# lo dicen sus mensajes.
{ set +x; } 2>/dev/null
# shellcheck source=ci/lib/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_env BUILD_PLATFORMS HARBOR_HOST HARBOR_USERNAME HARBOR_PASSWORD DOCKER_CONFIG
require_cmd buildctl curl base64

workers=$(mktemp)
# TERM e INT salen, y con eso pasan por EXIT: una trampa que solo borrara dejaría
# seguir al script sin sus ficheros temporales.
trap 'rm -f "$workers"' EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

buildctl debug workers | tee "$workers"

IFS=',' read -ra platforms <<<"$BUILD_PLATFORMS"
for plat in "${platforms[@]}"; do
  grep -qF -- "$plat" "$workers" || die \
    "buildkitd de este runner no anuncia ningun worker ${plat}; una imagen para ${BUILD_PLATFORMS} no se puede construir aqui con honestidad."
done

rc=0
curl -q -fsS --connect-timeout 3 --max-time 5 -o /dev/null "https://${HARBOR_HOST}/v2/" || rc=$?
[ "$rc" -eq 0 ] || [ "$rc" -eq 22 ] || die "https://${HARBOR_HOST}/v2/ no responde (curl salio ${rc})."

write_registry_auth "$HARBOR_HOST" "$HARBOR_USERNAME" "$HARBOR_PASSWORD" "${DOCKER_CONFIG}/config.json"
printf 'preflight OK: workers para %s, %s alcanzable, credencial en %s\n' \
  "$BUILD_PLATFORMS" "$HARBOR_HOST" "${DOCKER_CONFIG}/config.json"
