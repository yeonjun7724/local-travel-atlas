"""
OSMnx 로 추천 코스의 '실제 도보 경로'를 계산해 data/route-paths.json 으로 저장합니다.

- 보행 네트워크: OpenStreetMap (OSMnx network_type="walk") — ODbL 1.0
- 각 방문지 → 가장 가까운 보행 네트워크 노드로 연결한 뒤, 구간마다 길이(length) 기준 최단 경로
- 소요 시간 = 거리 ÷ 보행 속도(4.5 km/h) 로 계산한 '추정치'입니다(신호·계단·혼잡 미반영).
웹 앱은 실행 시 외부 API 를 부르지 않고 이 파일을 읽어 지도에 경로를 그립니다.

사용법: .venv/Scripts/python scripts/data-pipeline/build_routes.py
"""
from __future__ import annotations

import csv
import datetime as dt
import json
import math
import sys
import time
from pathlib import Path

import networkx as nx
import osmnx as ox

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).resolve().parent / "cache" / "osmnx"
WALK_KMH = 4.5
PAD = 0.004  # 코스 범위 바깥으로 약 400m 여유를 두고 네트워크를 받습니다

ox.settings.use_cache = True
ox.settings.cache_folder = str(CACHE)
ox.settings.http_user_agent = "LocalAtlas-education/1.0 (https://github.com/yeonjun7724/local-travel-atlas)"


def haversine(a, b) -> float:
    R = 6371000
    (lon1, lat1), (lon2, lat2) = a, b
    dlat, dlon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    h = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def edge_coords(G, u, v) -> list[tuple[float, float]]:
    """u→v 간선의 실제 형상 좌표(곡선 포함). 병렬 간선 중 가장 짧은 것을 사용."""
    data = min(G.get_edge_data(u, v).values(), key=lambda d: d.get("length", 0))
    if "geometry" in data:
        pts = list(data["geometry"].coords)
        # 형상이 v→u 방향으로 저장된 경우 뒤집기
        if haversine(pts[0], (G.nodes[u]["x"], G.nodes[u]["y"])) > haversine(pts[-1], (G.nodes[u]["x"], G.nodes[u]["y"])):
            pts.reverse()
        return pts
    return [(G.nodes[u]["x"], G.nodes[u]["y"]), (G.nodes[v]["x"], G.nodes[v]["y"])]


# 사용법: build_routes.py [jeonju|yangjae]  — jeonju = 동네 모드(data/), yangjae = 전국 모드 추천 코스(data/nationwide/)
FILES = {
    "jeonju": (ROOT / "data" / "places.csv", ROOT / "data" / "routes.json", ROOT / "data" / "route-paths.json"),
    "yangjae": (ROOT / "data" / "nationwide" / "yangjae-places.csv", ROOT / "data" / "nationwide" / "routes.json", ROOT / "data" / "nationwide" / "route-paths.json"),
}


def main():
    places_csv, routes_json, dest = FILES[sys.argv[1] if len(sys.argv) > 1 else "jeonju"]
    places = {r["id"]: r for r in csv.DictReader(places_csv.open(encoding="utf-8"))}
    routes = json.loads(routes_json.read_text(encoding="utf-8"))
    pts = [(float(places[i]["longitude"]), float(places[i]["latitude"])) for r in routes for i in r["placeIds"]]
    west, east = min(p[0] for p in pts) - PAD, max(p[0] for p in pts) + PAD
    south, north = min(p[1] for p in pts) - PAD, max(p[1] for p in pts) + PAD

    print("보행 네트워크 내려받는 중…", (west, south, east, north))
    G = None
    for attempt in range(6):  # 공용 Overpass 서버가 혼잡하면 502 → 지수 백오프로 재시도
        try:
            G = ox.graph_from_bbox((west, south, east, north), network_type="walk", simplify=True)
            break
        except Exception as e:  # noqa: BLE001
            wait = 15 * 2 ** attempt
            print(f"네트워크 다운로드 실패({type(e).__name__}), {wait}초 후 재시도")
            time.sleep(wait)
    if G is None:
        raise SystemExit("보행 네트워크를 받지 못했습니다. 잠시 후 다시 실행하세요.")
    print(f"노드 {len(G.nodes)} · 간선 {len(G.edges)}")

    out = {}
    for r in routes:
        stops = [(float(places[i]["longitude"]), float(places[i]["latitude"])) for i in r["placeIds"]]
        nodes = ox.distance.nearest_nodes(G, X=[p[0] for p in stops], Y=[p[1] for p in stops])
        geometry: list[tuple[float, float]] = []
        segments = []
        for k in range(len(stops) - 1):
            a, b = stops[k], stops[k + 1]
            u, v = int(nodes[k]), int(nodes[k + 1])
            path = nx.shortest_path(G, u, v, weight="length")
            seg = [a, (G.nodes[u]["x"], G.nodes[u]["y"])]  # 방문지 → 보행로 연결
            for x, y in zip(path[:-1], path[1:]):
                seg += edge_coords(G, x, y)[1:]
            seg += [b]  # 보행로 → 다음 방문지
            dist = sum(haversine(seg[i], seg[i + 1]) for i in range(len(seg) - 1))
            segments.append({"distanceM": round(dist), "durationS": round(dist / (WALK_KMH * 1000 / 3600))})
            geometry += seg if not geometry else seg[1:]
            print(f"  {r['routeId']} {k + 1}→{k + 2}: {dist:.0f}m (직선 {haversine(a, b):.0f}m)")
        total = sum(s["distanceM"] for s in segments)
        out[r["routeId"]] = {
            "totalDistanceM": total,
            "totalDurationS": sum(s["durationS"] for s in segments),
            "segments": segments,
            "geometry": [[round(x, 6), round(y, 6)] for x, y in geometry],
        }
        print(f"{r['routeId']}: 총 {total}m")

    result = {
        "generatedAt": dt.date.today().isoformat(),
        "source": "OpenStreetMap 보행 네트워크 · OSMnx (network_type=walk)",
        "license": "ODbL 1.0",
        "walkingSpeedKmh": WALK_KMH,
        "routes": out,
    }
    dest.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    print("저장:", dest)


if __name__ == "__main__":
    main()
