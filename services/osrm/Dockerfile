# 도보 경로 엔진 (OSRM · 대한민국 OpenStreetMap · foot 프로필)
# Railway 서비스 "osrm" 으로 배포: railway up services/osrm --path-as-root -s osrm
# /data 볼륨에 전처리 결과를 저장해 재시작 시 다시 만들지 않습니다.
FROM ghcr.io/project-osrm/osrm-backend:v5.27.1

RUN (apt-get update && apt-get install -y --no-install-recommends wget ca-certificates && rm -rf /var/lib/apt/lists/*) \
 || (apk add --no-cache wget ca-certificates)

COPY start.sh /start.sh
RUN chmod +x /start.sh

ENV OSRM_DATA=/data \
    OSRM_PBF_URL=https://download.geofabrik.de/asia/south-korea-latest.osm.pbf \
    PORT=5000

EXPOSE 5000
CMD ["/start.sh"]
