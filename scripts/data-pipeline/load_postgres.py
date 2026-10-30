"""
전국 장소 데이터를 PostGIS 에 적재합니다 (전국 모드 · Railway PostGIS).

입력
  1) data/raw/semas-food-nationwide.jsonl.gz  ← semas_nationwide.py 결과 (전국 음식점·카페)
  2) data/places.csv · data/nationwide/*-places.csv 의 OpenStreetMap 장소(osm-*) ← 관광·역사·자연 + 추천 코스 방문지 (전체 문서를 doc 열에 저장)

방식: places_new 테이블에 COPY → 인덱스 생성 → 한 트랜잭션에서 places 와 교체 (갱신 중에도 서비스 유지)

사용법:
  DATABASE_URL=postgresql://... .venv/Scripts/python scripts/data-pipeline/load_postgres.py
  (코스 방문지 CSV 만 바꿨다면 뒤에 --curated-only → 큐레이션 장소만 추가·갱신)
  (Railway: `railway variables -s PostGIS` 의 DATABASE_URL — 외부 TCP 프록시 주소. 값을 문서·채팅에 붙이지 마세요)
"""
from __future__ import annotations

import csv
import datetime as dt
import gzip
import json
import os
import sys
from pathlib import Path

import psycopg

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
SEMAS = ROOT / "data" / "raw" / "semas-food-nationwide.jsonl.gz"
CSV = ROOT / "data" / "places.csv"

DDL = """
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
DROP TABLE IF EXISTS places_new;
CREATE TABLE places_new (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  category   text NOT NULL,
  subtype    text,
  address    text NOT NULL,
  lon        double precision NOT NULL,
  lat        double precision NOT NULL,
  updated_at date,
  doc        jsonb,               -- OSM 등 큐레이션 장소의 전체 Place 문서(진흥공단 행은 NULL → API 가 템플릿으로 구성)
  geom       geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lon, lat), 4326)) STORED
);
CREATE TABLE IF NOT EXISTS atlas_meta (key text PRIMARY KEY, value text NOT NULL);
"""

INDEXES = """
CREATE INDEX places_new_geom ON places_new USING gist (geom);
CREATE INDEX places_new_name_trgm ON places_new USING gin (name gin_trgm_ops);
CREATE INDEX places_new_cat ON places_new (category, subtype);
ANALYZE places_new;
"""

SWAP = """
DROP TABLE IF EXISTS places_old;
ALTER TABLE IF EXISTS places RENAME TO places_old;
ALTER TABLE places_new RENAME TO places;
ALTER INDEX places_new_pkey RENAME TO places_pkey;
ALTER INDEX places_new_geom RENAME TO places_geom;
ALTER INDEX places_new_name_trgm RENAME TO places_name_trgm;
ALTER INDEX places_new_cat RENAME TO places_cat;
DROP TABLE IF EXISTS places_old;
"""


def curated_rows():
    """places.csv + data/nationwide/*-places.csv 의 OSM 장소 → Place 문서(앱의 Zod 변환 결과와 같은 모양)"""
    files = [CSV, *sorted((ROOT / "data" / "nationwide").glob("*-places.csv"))]
    for r in (row for f in files for row in csv.DictReader(f.open(encoding="utf-8-sig"))):
        if not r["id"].startswith("osm-"):
            continue
        doc = {k: v for k, v in r.items() if v not in ("", None)}
        doc["latitude"], doc["longitude"] = float(r["latitude"]), float(r["longitude"])
        doc["tags"] = [t.strip() for t in r.get("tags", "").split("|") if t.strip()]
        doc["isSample"] = r.get("isSample", "").lower() == "true"
        if r.get("recommendedDurationMinutes"):
            doc["recommendedDurationMinutes"] = int(r["recommendedDurationMinutes"])
        doc.setdefault("nameEn", "")
        doc.setdefault("descriptionEn", "")
        doc.setdefault("imageUrl", "")
        yield (r["id"], r["nameKo"], r["category"], r.get("subtype") or None, r["address"],
               doc["longitude"], doc["latitude"], r.get("updatedAt") or None, json.dumps(doc, ensure_ascii=False))


def semas_rows(seen: set[str]):
    with gzip.open(SEMAS, "rt", encoding="utf-8") as fh:
        for line in fh:
            x = json.loads(line)
            pid = f"semas-{x['id'].lower()}"
            name = f"{x['name']} {x['branch']}".strip()
            if pid in seen or not name:
                continue
            seen.add(pid)
            addr = x["road"] or x["jibun"] or f"{x['sido']} {x['sigungu']}".strip()
            if x["floor"]:
                addr += f" ({x['floor']}층)"
            yield (pid, name, x["category"], x["subtype"] or None, addr, round(x["lon"], 6), round(x["lat"], 6), None, None)


def upsert_curated(url: str):
    """--curated-only: 진흥공단 데이터는 그대로 두고 OSM 큐레이션 장소(코스 방문지)만 추가·갱신합니다(수 초)."""
    with psycopg.connect(url) as conn, conn.cursor() as cur:
        rows = list(curated_rows())
        cur.executemany(
            """INSERT INTO places (id, name, category, subtype, address, lon, lat, updated_at, doc)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, subtype = EXCLUDED.subtype,
                 address = EXCLUDED.address, lon = EXCLUDED.lon, lat = EXCLUDED.lat, updated_at = EXCLUDED.updated_at, doc = EXCLUDED.doc""",
            rows,
        )
        conn.commit()
        print(f"큐레이션 장소 {len(rows)}곳 추가·갱신")


def main():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL 환경변수가 필요합니다.")
    if "--curated-only" in sys.argv:
        return upsert_curated(url)
    if not SEMAS.exists():
        raise SystemExit(f"{SEMAS} 가 없습니다 → 먼저 semas_nationwide.py 를 실행하세요.")
    stdr = ""
    with gzip.open(SEMAS, "rt", encoding="utf-8") as fh:
        stdr = json.loads(fh.readline()).get("stdrYm") or ""

    with psycopg.connect(url, autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute(DDL)
            seen: set[str] = set()
            n = 0
            cols = "(id, name, category, subtype, address, lon, lat, updated_at, doc)"
            with cur.copy(f"COPY places_new {cols} FROM STDIN") as cp:
                for row in curated_rows():
                    seen.add(row[0])
                    cp.write_row(row)
                    n += 1
                print(f"큐레이션(OSM) {n}곳")
                for row in semas_rows(seen):
                    cp.write_row(row)
                    n += 1
                    if n % 100_000 == 0:
                        print(f"  {n:,}")
            print(f"COPY 완료 {n:,}곳 → 인덱스 생성 중…")
            cur.execute(INDEXES)
            cur.execute(SWAP)
            meta = {
                "loadedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                "semasStdrYm": stdr,
                "count": str(n),
            }
            for k, v in meta.items():
                cur.execute("INSERT INTO atlas_meta (key, value) VALUES (%s, %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", (k, v))
        conn.commit()
        with conn.cursor() as cur:
            cur.execute("SELECT category, count(*) FROM places GROUP BY 1 ORDER BY 2 DESC")
            print("적재 결과:", ", ".join(f"{c} {k:,}" for c, k in cur.fetchall()))


if __name__ == "__main__":
    main()
