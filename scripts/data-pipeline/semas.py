"""
소상공인시장진흥공단 상가(상권)정보 수집기 — 음식점·카페 POI

공공데이터포털: "소상공인시장진흥공단_상가(상권)정보" (이용허락범위 제한 없음)
두 가지 입력을 지원합니다.
  A) API  : .env.local 에 SEMAS_SERVICE_KEY=<일반 인증키(Decoding)>  → storeListInRectangle 호출
  B) 파일 : data/raw/ 에 내려받은 CSV(전북 등) 를 두면 자동으로 읽습니다.
반환: 표준화된 dict 목록 (id, name, branch, large/mid/small 업종명, 도로명/지번주소, lat, lon)
"""
from __future__ import annotations

import csv
import json
import os
import re
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).resolve().parent / "cache"
RAW = ROOT / "data" / "raw"
API = "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRectangle"


def service_key() -> str | None:
    if os.environ.get("SEMAS_SERVICE_KEY"):
        return os.environ["SEMAS_SERVICE_KEY"].strip()
    env = ROOT / ".env.local"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("SEMAS_SERVICE_KEY="):
                v = line.split("=", 1)[1].strip().strip('"').strip("'")
                return v or None
    return None


def _norm(rec: dict) -> dict:
    g = lambda *keys: next((str(rec[k]).strip() for k in keys if rec.get(k) not in (None, "")), "")
    return {
        "id": g("bizesId", "상가업소번호"),
        "name": g("bizesNm", "상호명"),
        "branch": g("brchNm", "지점명"),
        "large": g("indsLclsNm", "상권업종대분류명"),
        "mid": g("indsMclsNm", "상권업종중분류명"),
        "small": g("indsSclsNm", "상권업종소분류명"),
        "road": g("rdnmAdr", "도로명주소"),
        "jibun": g("lnoAdr", "지번주소"),
        "floor": g("flrNo", "층정보"),
        "lat": float(g("lat", "위도") or 0),
        "lon": float(g("lon", "경도") or 0),
    }


def from_api(key: str, bbox: tuple[float, float, float, float]) -> list[dict]:
    s, w, n, e = bbox
    cache = CACHE / f"semas-api-{s}-{w}-{n}-{e}.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    out, page = [], 1
    while True:
        r = requests.get(API, timeout=60, params={
            "serviceKey": key, "pageNo": page, "numOfRows": 1000, "minx": w, "miny": s, "maxx": e, "maxy": n, "type": "json"})
        if r.status_code != 200:
            raise RuntimeError(f"진흥공단 API HTTP {r.status_code}: 키 승인(활용신청 후 최대 1~2시간) 또는 Decoding 키 여부를 확인하세요. {r.text[:200]}")
        body = r.json().get("body", {})
        items = body.get("items") or []
        out += [_norm(x) for x in items]
        total = int(body.get("totalCount") or 0)
        if page * 1000 >= total or not items:
            break
        page += 1
        time.sleep(0.3)
    cache.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    return out


def from_files(bbox: tuple[float, float, float, float]) -> list[dict]:
    s, w, n, e = bbox
    out = []
    for f in sorted(RAW.glob("*.csv")):
        for enc in ("utf-8-sig", "cp949"):
            try:
                with f.open(encoding=enc, newline="") as fh:
                    for rec in csv.DictReader(fh):
                        x = _norm(rec)
                        if s <= x["lat"] <= n and w <= x["lon"] <= e:
                            out.append(x)
                break
            except UnicodeDecodeError:
                out = [o for o in out]  # 다른 인코딩으로 재시도
                continue
    return out


def load(bbox: tuple[float, float, float, float]) -> tuple[list[dict], str] | None:
    """(목록, 출처 설명) 또는 데이터가 없으면 None"""
    key = service_key()
    if key:
        return from_api(key, bbox), "소상공인시장진흥공단 상가(상권)정보 API"
    if RAW.exists() and any(RAW.glob("*.csv")):
        return from_files(bbox), "소상공인시장진흥공단 상가(상권)정보 파일"
    return None


CAFE_RE = re.compile(r"카페|커피|비알코올|제과|베이커리|빵|아이스크림|빙수|차 전문|다방|디저트")


def classify(x: dict) -> tuple[str, str] | None:
    """음식 업종만 사용. (category, 소분류명)"""
    if "음식" not in x["large"]:
        return None
    if "유흥" in x["small"] or "무도" in x["small"]:
        return None  # 유흥·무도 주점은 여행 지도에서 제외
    label = x["small"] or x["mid"]
    return ("cafe" if CAFE_RE.search(f"{x['mid']} {x['small']}") else "food"), label
