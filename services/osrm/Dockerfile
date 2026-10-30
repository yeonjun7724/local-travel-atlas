# 도보 경로 엔진 (OSRM · 대한민국 OpenStreetMap · foot 프로필)
# Railway 서비스 "osrm" 으로 배포: railway up services/osrm --path-as-root -s osrm
# /data 볼륨에 전처리 결과를 저장해 재시작 시 다시 만들지 않습니다.
# OSM 데이터를 새로 받으려면 재배포 후 볼륨의 korea.osrm.ready 를 지우세요.

# 1) OSM 원본 내려받기 (OSRM 이미지는 패키지 저장소가 종료된 Debian 기반이라 별도 단계에서 받음)
FROM curlimages/curl:8.10.1 AS pbf
ARG OSRM_PBF_URL=https://download.geofabrik.de/asia/south-korea-latest.osm.pbf
RUN curl -fsSL --retry 5 -o /tmp/korea.osm.pbf "$OSRM_PBF_URL"

# 2) OSRM
FROM ghcr.io/project-osrm/osrm-backend:v5.27.1
COPY --from=pbf /tmp/korea.osm.pbf /opt/korea.osm.pbf
COPY start.sh /start.sh
RUN chmod +x /start.sh

ENV OSRM_DATA=/data \
    PORT=5000

EXPOSE 5000
CMD ["/start.sh"]
