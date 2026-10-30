"""
소상공인시장진흥공단 상가(상권)정보 — 전국 '음식'(대분류 I2) 업소 전체 수집

- API: storeListInUpjong (divId=indsLclsCd, key=I2), 1,000건씩 페이지 단위
- 페이지마다 cache/semas-nationwide/page-XXXX.json 에 저장 → 중간에 끊겨도 다시 실행하면 이어서 받습니다.
- 결과: data/raw/semas-food-nationwide.jsonl.gz (표준화된 행, 저장소에는 커밋하지 않음)
- 이후 load_postgres.py 로 PostGIS 에 적재합니다.

사용법: .venv/Scripts/python scripts/data-pipeline/semas_nationwide.py
(키: 환경변수 또는 .env.local 의 SEMAS_SERVICE_KEY — 출력하지 않습니다)
"""
from __future__ import annotations

import gzip
import json
import sys
import time
from pathlib import Path

import requests

from semas import CACHE, ROOT, _norm, classify, service_key

sys.stdout.reconfigure(encoding="utf-8")

API = "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInUpjong"
ROWS = 1000
PAGES = CACHE / "semas-nationwide"
OUT = ROOT / "data" / "raw" / "semas-food-nationwide.jsonl.gz"


def fetch_page(key: str, page: int) -> dict:
    for attempt in range(6):
        try:
            r = requests.get(API, timeout=90, params={
                "serviceKey": key, "divId": "indsLclsCd", "key": "I2", "pageNo": page, "numOfRows": ROWS, "type": "json"})
            if r.status_code == 200:
                body = r.json().get("body") or {}
                return {"total": int(body.get("totalCount") or 0), "items": body.get("items") or [], "stdrYm": (r.json().get("header") or {}).get("stdrYm")}
            print(f"  page {page}: HTTP {r.status_code}")
        except (requests.RequestException, ValueError) as e:
            print(f"  page {page}: {type(e).__name__}")
        time.sleep(5 * 2 ** attempt)
    raise SystemExit(f"page {page} 를 받지 못했습니다. 다시 실행하면 이어서 받습니다.")


def main():
    key = service_key()
    if not key:
        raise SystemExit("SEMAS_SERVICE_KEY 가 없습니다 (.env.local).")
    PAGES.mkdir(parents=True, exist_ok=True)
    first = PAGES / "page-0001.json"
    if not first.exists():
        first.write_text(json.dumps(fetch_page(key, 1), ensure_ascii=False), encoding="utf-8")
    meta = json.loads(first.read_text(encoding="utf-8"))
    pages = -(-meta["total"] // ROWS)
    print(f"전국 음식 업소 {meta['total']:,}곳 · {pages}페이지 (기준 {meta.get('stdrYm')})")
    for page in range(2, pages + 1):
        f = PAGES / f"page-{page:04d}.json"
        if f.exists():
            continue
        data = fetch_page(key, page)
        f.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        if page % 25 == 0:
            print(f"  {page}/{pages}")
        time.sleep(0.2)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    seen, kept, skipped = set(), 0, 0
    with gzip.open(OUT, "wt", encoding="utf-8") as fh:
        for page in range(1, pages + 1):
            for rec in json.loads((PAGES / f"page-{page:04d}.json").read_text(encoding="utf-8"))["items"]:
                x = _norm(rec)
                c = classify(x)
                if not c or x["id"] in seen or not (33 < x["lat"] < 39 and 124 < x["lon"] < 132):
                    skipped += 1
                    continue
                seen.add(x["id"])
                x["category"], x["subtype"] = c
                x["sido"], x["sigungu"] = rec.get("ctprvnNm") or "", rec.get("signguNm") or ""
                x["stdrYm"] = meta.get("stdrYm")
                fh.write(json.dumps(x, ensure_ascii=False) + "\n")
                kept += 1
    print(f"저장: {OUT} · {kept:,}곳 (제외 {skipped:,})")


if __name__ == "__main__":
    main()
