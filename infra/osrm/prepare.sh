#!/usr/bin/env bash
# Türkiye OSM verisini indirir, istenirse bir kutuya keser ve OSRM (MLD) için hazırlar.
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p data
PBF_URL="https://download.geofabrik.de/europe/turkey-latest.osm.pbf"

if [ ! -f data/turkey-latest.osm.pbf ]; then
  echo "Türkiye verisi indiriliyor (Geofabrik, ~621 MB)…"
  curl -L --fail -o data/turkey-latest.osm.pbf "$PBF_URL"
fi

if [ -n "${BBOX:-}" ]; then
  echo "Kutu kesiliyor: $BBOX"
  docker run --rm -v "$PWD/data:/data" debian:bookworm-slim sh -c \
    "apt-get update -qq && apt-get install -y -qq osmium-tool >/dev/null && \
     osmium extract -b '$BBOX' /data/turkey-latest.osm.pbf -o /data/region.osm.pbf --overwrite"
else
  cp data/turkey-latest.osm.pbf data/region.osm.pbf
fi

IMG=ghcr.io/project-osrm/osrm-backend:v5.27.1
docker run --rm -t -v "$PWD/data:/data" $IMG osrm-extract -p /opt/car.lua /data/region.osm.pbf
docker run --rm -t -v "$PWD/data:/data" $IMG osrm-partition /data/region.osrm
docker run --rm -t -v "$PWD/data:/data" $IMG osrm-customize /data/region.osrm
echo "Hazır. Başlat: docker compose -f infra/osrm/docker-compose.yml up -d"
