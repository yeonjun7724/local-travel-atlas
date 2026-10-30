#!/bin/sh
# 처음 한 번: extract(foot) → partition → customize (MLD). 이후에는 바로 서버 시작.
set -eu
mkdir -p "$OSRM_DATA"
cd "$OSRM_DATA"
BASE=korea

if [ ! -f "$BASE.osrm.ready" ]; then
  echo "[osrm] 전처리 시작"
  rm -f "$BASE".osrm*
  cp /opt/korea.osm.pbf "$BASE.osm.pbf"
  osrm-extract -p /opt/foot.lua "$BASE.osm.pbf"
  osrm-partition "$BASE.osrm"
  osrm-customize "$BASE.osrm"
  rm -f "$BASE.osm.pbf"
  date -u +%Y-%m-%dT%H:%M:%SZ > "$BASE.osrm.ready"
  echo "[osrm] 전처리 완료"
fi

echo "[osrm] 데이터 기준: $(cat "$BASE.osrm.ready")"
exec osrm-routed --algorithm mld --max-viaroute-size 50 --port "$PORT" "$BASE.osrm"
