#!/usr/bin/env bash
# Isolated smoke test: no published ports, LAN access, or AVR commands.
set -euo pipefail
image=${1:-uc-intg-onkyo-avr:local}
prefix="onkyo-smoke-$$"
volume="$prefix-config"
container="$prefix"
cleanup() {
  docker logs "$container" 2>/dev/null || true
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT
# Refuse reuse: this script only deletes resources it creates.
if docker container inspect "$container" >/dev/null 2>&1 || docker volume inspect "$volume" >/dev/null 2>&1; then
  trap - EXIT
  exit 1
fi
docker volume create "$volume" >/dev/null
start() {
  docker run -d --name "$container" --network none --init \
    --cap-drop ALL --security-opt no-new-privileges:true \
    -e UC_DISABLE_MDNS_PUBLISH=true -v "$volume:/config" "$image" >/dev/null
  for attempt in {1..30}; do
    if docker exec "$container" node docker/healthcheck.mjs; then return; fi
    sleep 1
  done
  return 1
}
start
# Test default CMD, actual WebSocket protocol, assets, UID and config write.
docker exec -i "$container" node --input-type=module < docker/smoke-probe.mjs
docker stop --time 20 "$container" >/dev/null
test "$(docker inspect -f '{{.State.ExitCode}}' "$container")" != 137
docker rm "$container" >/dev/null
start
docker exec -i -e SMOKE_RECREATED=true "$container" node --input-type=module < docker/smoke-probe.mjs
printf 'PASS: default CMD, WebSocket metadata, assets, non-root, persistent volume, SIGTERM/recreate\n'
