"""
실데이터 수집 파이프라인 — data/places.csv 생성

출처(모두 실제·공개 데이터, 라이선스 표기 필수):
  - OpenStreetMap (Overpass API)      : 장소 이름·좌표·종류·영업시간·웹사이트  — ODbL 1.0
  - Nominatim (OSM 역지오코딩)          : 주소                                  — ODbL 1.0
  - Wikidata                           : 다국어 이름, 대표 이미지 연결          — CC0
  - 위키백과 (ko/en)                    : 장소 설명 요약                          — CC BY-SA 4.0
  - Wikimedia Commons                  : 사진 + 저작자·라이선스                 — 파일별 라이선스
  - 소상공인시장진흥공단 상가(상권)정보 : 음식점·카페 (키/파일이 있을 때 OSM 음식점·카페를 대체) — 이용허락범위 제한 없음

원칙: 출처에 없는 정보(평점·가격·영업시간·사진)는 만들지 않는다. 설명이 없으면 OSM 태그에서
사실만 조합한 문장을 쓰고, 그 사실을 descriptionSource 에 "OpenStreetMap 태그" 로 남긴다.

사용법:
  python -m venv .venv && .venv/Scripts/pip install osmnx requests   (Windows)
  .venv/Scripts/python scripts/data-pipeline/fetch_places.py
결과를 확인한 뒤 npm run validate:data 를 실행한다. 응답은 cache/ 에 저장되어 재실행 시 재사용된다.
"""
from __future__ import annotations

import csv
import datetime as dt
import html
import json
import re
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
import semas  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).resolve().parent / "cache"
CACHE.mkdir(exist_ok=True)
OUT = ROOT / "data" / "places.csv"

# 전주 한옥마을 일대 (남, 서, 북, 동)
BBOX = (35.8030, 127.1390, 35.8240, 127.1640)
UA = {"User-Agent": "LocalAtlas-education/1.0 (https://github.com/yeonjun7724/local-travel-atlas)"}
TODAY = dt.date.today().isoformat()


def cached(name: str, fn):
    p = CACHE / name
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    data = fn()
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


# ── 1. OpenStreetMap 장소 수집 ────────────────────────────────────────────
def overpass():
    s, w, n, e = BBOX
    b = f"({s},{w},{n},{e})"
    q = f"""[out:json][timeout:90];
(
 nwr["name"]["amenity"~"^(restaurant|cafe|fast_food|ice_cream|place_of_worship|marketplace)$"]{b};
 nwr["name"]["shop"~"^(bakery|confectionery|tea)$"]{b};
 nwr["name"]["tourism"~"^(attraction|museum|gallery|viewpoint|artwork)$"]{b};
 nwr["name"]["historic"]{b};
 nwr["name"]["leisure"~"^(park|garden)$"]{b};
 nwr["name"]["natural"~"^(peak|wood)$"]{b};
);
out center tags;"""
    for attempt in range(5):  # 공용 서버라 일시적인 502/504/429 가 잦습니다 → 간격을 늘리며 재시도
        r = requests.post("https://overpass-api.de/api/interpreter", data={"data": q}, headers=UA, timeout=180)
        if r.status_code == 200:
            return r.json()["elements"]
        print(f"Overpass HTTP {r.status_code}, {10 * (attempt + 1)}초 후 재시도")
        time.sleep(10 * (attempt + 1))
    r.raise_for_status()


SUBTYPE_KO = {
    "restaurant": "음식점", "fast_food": "패스트푸드점", "marketplace": "시장", "cafe": "카페", "ice_cream": "아이스크림 가게",
    "bakery": "빵집", "confectionery": "과자점", "tea": "찻집", "museum": "박물관·전시관", "gallery": "갤러리",
    "attraction": "관광 명소", "viewpoint": "전망 명소", "artwork": "공공 미술작품", "peak": "봉우리", "wood": "숲",
    "tree": "노거수", "park": "공원", "garden": "정원", "monument": "기념물", "memorial": "기념비",
    "archaeological_site": "유적지", "castle": "성곽·성문", "boundary_stone": "표석", "building": "역사 건축물",
    "place_of_worship": "종교 시설", "yes": "역사 유적",
}
SUBTYPE_EN = {
    "restaurant": "restaurant", "fast_food": "fast-food restaurant", "marketplace": "market", "cafe": "café",
    "ice_cream": "ice-cream shop", "bakery": "bakery", "confectionery": "confectionery", "tea": "tea house",
    "museum": "museum", "gallery": "gallery", "attraction": "attraction", "viewpoint": "viewpoint",
    "artwork": "public artwork", "peak": "peak", "wood": "forest", "tree": "old tree", "park": "park", "garden": "garden",
    "monument": "monument", "memorial": "memorial", "archaeological_site": "archaeological site", "castle": "fortress gate",
    "boundary_stone": "marker stone", "building": "historic building", "place_of_worship": "place of worship", "yes": "historic site",
}
CUISINE_KO = {
    "korean": "한식", "coffee_shop": "커피", "chicken": "치킨", "pizza": "피자", "burger": "버거", "japanese": "일식",
    "chinese": "중식", "italian": "이탈리안", "noodle": "국수", "bibimbap": "비빔밥", "ice_cream": "아이스크림",
    "tea": "차", "dessert": "디저트", "cake": "케이크", "sandwich": "샌드위치", "regional": "향토 음식",
    "dumpling": "만두", "western": "양식", "barbecue": "바비큐", "bubble_tea": "버블티", "donut": "도넛", "bread": "빵",
}
THEME_OF = {"food": "local-food", "cafe": "cafe-alley", "history": "history", "landmark": "landmark", "nature": "nature-rest"}


def classify(t: dict) -> tuple[str, str] | None:
    """(category, subtype) 를 돌려준다. 제외 대상은 None."""
    a, h, tour, nat, lei, shop = t.get("amenity"), t.get("historic"), t.get("tourism"), t.get("natural"), t.get("leisure"), t.get("shop")
    if nat in ("peak", "wood", "tree") or lei in ("park", "garden"):
        return "nature", nat or lei
    if tour == "viewpoint":
        return "nature", "viewpoint"
    if tour == "museum":
        return "history", "museum"
    if h:
        # 경기전 안의 부속 건물처럼 이름만 있는 건물은 너무 세분화되므로, 위키데이터가 있는 것만 포함
        if h == "building" and "wikidata" not in t:
            return None
        return "history", h
    if a == "place_of_worship":
        return ("history", "place_of_worship") if ("wikidata" in t or tour) else None
    if tour in ("attraction", "artwork", "gallery"):
        return "landmark", tour
    if a in ("cafe", "ice_cream") or shop in ("bakery", "confectionery", "tea"):
        return "cafe", a if a in ("cafe", "ice_cream") else shop
    if a in ("restaurant", "fast_food", "marketplace"):
        return "food", a
    return None


# ── 2. Wikidata / 위키백과 / Commons 보강 ──────────────────────────────────
def wikidata_entities(qids: list[str]) -> dict:
    def fetch():
        out = {}
        for i in range(0, len(qids), 40):
            r = requests.get("https://www.wikidata.org/w/api.php", headers=UA, timeout=60, params={
                "action": "wbgetentities", "format": "json", "ids": "|".join(qids[i:i + 40]),
                "props": "labels|descriptions|claims|sitelinks", "languages": "ko|en"})
            out.update(r.json().get("entities", {}))
        return out
    return cached(f"wikidata-{len(qids)}-{abs(hash(tuple(qids))) % 10**8}.json", fetch) if qids else {}


def wiki_summary(lang: str, title: str) -> dict | None:
    key = f"wp-{lang}-{re.sub(r'[^0-9A-Za-z가-힣]+', '_', title)}.json"

    def fetch():
        r = requests.get(f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(title)}", headers=UA, timeout=30)
        if r.status_code != 200:
            return {}
        j = r.json()
        img = (j.get("originalimage") or {}).get("source", "")
        return {"extract": j.get("extract", ""), "url": j.get("content_urls", {}).get("desktop", {}).get("page", ""),
                "image": requests.utils.unquote(img.rsplit("/", 1)[-1]) if "/commons/" in img else ""}
    d = cached(key, fetch)
    return d or None


def commons_image(filename: str) -> dict | None:
    key = "commons-" + re.sub(r"[^0-9A-Za-z]+", "_", filename)[:80] + ".json"

    def fetch():
        r = requests.get("https://commons.wikimedia.org/w/api.php", headers=UA, timeout=30, params={
            "action": "query", "format": "json", "titles": f"File:{filename}", "prop": "imageinfo",
            "iiprop": "url|extmetadata", "iiurlwidth": 960})
        pages = r.json().get("query", {}).get("pages", {})
        for p in pages.values():
            ii = (p.get("imageinfo") or [None])[0]
            if not ii:
                return {}
            md = ii.get("extmetadata", {})
            strip = lambda s: re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s or ""))).strip()
            return {
                "url": ii.get("thumburl") or ii.get("url"),
                "page": ii.get("descriptionurl", ""),
                "artist": strip(md.get("Artist", {}).get("value", ""))[:80],
                "license": strip(md.get("LicenseShortName", {}).get("value", "")),
            }
        return {}
    d = cached(key, fetch)
    return d or None


def first_sentences(text: str, n: int = 2, limit: int = 260) -> str:
    parts = re.split(r"(?<=[.!?。])\s+|(?<=다\.)\s*", text.strip())
    s = " ".join(p for p in parts[:n] if p).strip()
    return (s[: limit - 1] + "…") if len(s) > limit else s


def haversine_m(lat1, lon1, lat2, lon2) -> float:
    import math
    R = 6371000
    dlat, dlon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def match_wikidata(name: str, lat: float, lon: float, max_m: float = 400) -> str | None:
    """OSM 에 wikidata 태그가 없는 명소를 이름으로 검색하되, 위키데이터 좌표(P625)가 400m 이내일 때만 연결합니다."""
    key = "wdsearch-" + re.sub(r"[^0-9A-Za-z가-힣]+", "_", name) + ".json"

    def fetch():
        r = requests.get("https://www.wikidata.org/w/api.php", headers=UA, timeout=30, params={
            "action": "wbsearchentities", "format": "json", "language": "ko", "uselang": "ko", "search": name, "limit": 7})
        ids = [x["id"] for x in r.json().get("search", [])]
        if not ids:
            return []
        r2 = requests.get("https://www.wikidata.org/w/api.php", headers=UA, timeout=30, params={
            "action": "wbgetentities", "format": "json", "ids": "|".join(ids), "props": "claims"})
        res = []
        for qid, ent in r2.json().get("entities", {}).items():
            for c in ent.get("claims", {}).get("P625", []):
                v = c["mainsnak"].get("datavalue", {}).get("value")
                if v:
                    res.append([qid, v["latitude"], v["longitude"]])
        return res
    best = None
    for qid, la, lo in cached(key, fetch):
        d = haversine_m(lat, lon, la, lo)
        if d <= max_m and (best is None or d < best[1]):
            best = (qid, d)
    return best[0] if best else None


# ── 3. 주소 (Nominatim 역지오코딩, 초당 1회 제한 준수) ──────────────────────
def reverse_address(lat: float, lon: float) -> str:
    key = f"nominatim-{lat:.6f}-{lon:.6f}.json"
    p = CACHE / key
    if p.exists():
        j = json.loads(p.read_text(encoding="utf-8"))
    else:
        time.sleep(1.1)
        r = requests.get("https://nominatim.openstreetmap.org/reverse", headers=UA, timeout=30, params={
            "format": "jsonv2", "lat": lat, "lon": lon, "zoom": 18, "accept-language": "ko", "addressdetails": 1})
        j = r.json() if r.status_code == 200 else {}
        p.write_text(json.dumps(j, ensure_ascii=False), encoding="utf-8")
    a = j.get("address", {})
    city = a.get("city") or a.get("county") or "전주시"
    gu = a.get("borough") or a.get("city_district") or ""
    road = a.get("road", "")
    # 보행로·출구·자전거길 이름이 '도로'로 잡히는 경우가 있어, 도로명(…로/…길) 형태만 인정합니다.
    if road and (not re.search(r"(로|길)(\s?\d+번?길)?$", road) or re.search(r"출구|자전거|산책로|등산로", road)):
        road = ""
    dong = a.get("quarter") or a.get("suburb") or a.get("neighbourhood") or ""
    street = road or dong
    num = a.get("house_number", "")
    parts = ["전북특별자치도" if "전북" in (a.get("province", "") + a.get("state", "")) or not a else (a.get("province") or a.get("state") or ""), city, gu, street, num]
    addr = " ".join(x for x in parts if x).strip()
    return addr if num else f"{addr} 일대"  # 번지가 없으면 근사 위치임을 표시


def osm_address(t: dict) -> str | None:
    if t.get("addr:full"):
        return t["addr:full"]
    if t.get("addr:street") and re.search(r"[가-힣]", t["addr:street"]):
        return " ".join(x for x in ["전북특별자치도 전주시", t.get("addr:district", ""), t["addr:street"], t.get("addr:housenumber", "")] if x)
    return None


# ── 4. 조립 ───────────────────────────────────────────────────────────────
def main():
    els = cached("overpass.json", overpass)
    print(f"OSM 원본 {len(els)}건")

    rows: dict[str, dict] = {}
    seen_wd: set[str] = set()
    seen_name: set[str] = set()
    # 위키데이터가 있는 요소·면(way)을 먼저 처리해 중복 시 정보가 많은 쪽을 남긴다
    els.sort(key=lambda e: ("wikidata" not in e["tags"], e["type"] != "way", -len(e["tags"])))
    for e in els:
        t = e["tags"]
        c = classify(t)
        if not c:
            continue
        name = t["name"].strip()
        wd = t.get("wikidata")
        norm = re.sub(r"\s+", "", name)
        if (wd and wd in seen_wd) or norm in seen_name:
            continue
        seen_name.add(norm)
        if wd:
            seen_wd.add(wd)
        lat = e.get("lat") or e["center"]["lat"]
        lon = e.get("lon") or e["center"]["lon"]
        rows[f"osm-{e['type'][0]}{e['id']}"] = {"el": e, "cat": c[0], "sub": c[1], "lat": lat, "lon": lon}
    print(f"분류·중복 제거 후 {len(rows)}건")

    # 명소·역사·자연 중 wikidata 가 없는 곳은 이름+좌표로 안전하게 연결 시도
    for r in rows.values():
        t = r["el"]["tags"]
        if "wikidata" not in t and r["cat"] in ("history", "landmark", "nature"):
            qid = match_wikidata(t["name"], r["lat"], r["lon"])
            if qid and qid not in seen_wd:
                t["wikidata"] = qid
                r["wd_matched"] = True
                seen_wd.add(qid)
    print(f"이름+좌표로 위키데이터 연결: {sum(1 for r in rows.values() if r.get('wd_matched'))}건")

    entities = wikidata_entities(sorted({r["el"]["tags"]["wikidata"] for r in rows.values() if "wikidata" in r["el"]["tags"]}))

    out = []
    for pid, r in rows.items():
        t = r["el"]["tags"]
        cat, sub = r["cat"], r["sub"]
        ent = entities.get(t.get("wikidata", ""), {})
        labels = ent.get("labels", {})
        name_ko = t.get("name:ko") or t["name"]
        name_en = t.get("name:en") or labels.get("en", {}).get("value", "")
        if re.fullmatch(r"[A-Za-z0-9 .,'()&-]+", name_ko) and not name_en:
            name_en = name_ko  # 이름 자체가 영문인 경우

        # 설명: 위키백과 요약 → 없으면 OSM 태그에서 사실만 조합
        desc_ko = desc_en = ""
        desc_src = desc_src_url = ""
        sl = ent.get("sitelinks", {})
        wiki_img = ""
        if "kowiki" in sl:
            s = wiki_summary("ko", sl["kowiki"]["title"])
            wiki_img = (s or {}).get("image", "")
            if s and s["extract"]:
                desc_ko, desc_src, desc_src_url = first_sentences(s["extract"]), "위키백과 (CC BY-SA 4.0)", s["url"]
        if "enwiki" in sl:
            s = wiki_summary("en", sl["enwiki"]["title"])
            if s and s["extract"]:
                desc_en = first_sentences(s["extract"])
                if not desc_src:
                    desc_src, desc_src_url = "Wikipedia (CC BY-SA 4.0)", s["url"]
        cuisines = [x.strip() for x in t.get("cuisine", "").split(";") if x.strip()]
        cu_ko = ", ".join(CUISINE_KO.get(x, x) for x in cuisines)
        cu_en = ", ".join(x.replace("_", " ") for x in cuisines)
        if not desc_ko:
            desc_ko = f"전주 한옥마을 일대의 {SUBTYPE_KO.get(sub, sub)}입니다." + (f" 음식 종류: {cu_ko}." if cu_ko else "")
            desc_src = desc_src or "OpenStreetMap 태그"
        if not desc_en and (name_en or desc_src.startswith("OpenStreetMap")):
            desc_en = f"A {SUBTYPE_EN.get(sub, sub)} in the Jeonju Hanok Village area." + (f" Cuisine: {cu_en}." if cu_en else "")
        if not desc_src_url:
            desc_src_url = f"https://www.openstreetmap.org/{r['el']['type']}/{r['el']['id']}"

        # 사진: OSM wikimedia_commons/image 태그 → Wikidata P18 (Commons 파일만, 라이선스 확인)
        img = None
        fname = None
        wc = t.get("wikimedia_commons", "")
        if wc.startswith("File:"):
            fname = wc[5:]
        elif ent.get("claims", {}).get("P18"):
            fname = ent["claims"]["P18"][0]["mainsnak"].get("datavalue", {}).get("value")
        elif wiki_img:
            fname = wiki_img  # 위키백과 문서의 대표 이미지(Commons 파일만 사용)
        if fname:
            img = commons_image(fname)
        image_url = img["url"] if img and img.get("url") and img.get("license") else ""
        image_credit = f"{img['artist'] or '작성자 미상'} · {img['license']} · Wikimedia Commons" if image_url else ""

        tags = [SUBTYPE_KO.get(sub, sub)] + [CUISINE_KO.get(x, x) for x in cuisines][:2]
        if t.get("wikidata"):
            tags.append("위키데이터")
        website = t.get("website") or t.get("contact:website") or ""
        if website and not website.startswith(("http://", "https://")):
            website = "https://" + website

        out.append({
            "id": pid,
            "nameKo": name_ko,
            "nameEn": name_en,
            "latitude": f"{r['lat']:.6f}",
            "longitude": f"{r['lon']:.6f}",
            "category": cat,
            "theme": THEME_OF[cat],
            "descriptionKo": desc_ko,
            "descriptionEn": desc_en,
            "address": osm_address(t) or reverse_address(r["lat"], r["lon"]),
            "imageUrl": image_url,
            "source": "OpenStreetMap 기여자",
            "license": "ODbL 1.0",
            "openingHours": t.get("opening_hours", ""),
            "tags": "|".join(dict.fromkeys(x for x in tags if x)),
            "externalUrl": website,
            "recommendedDurationMinutes": "",
            "updatedAt": TODAY,
            "isSample": "false",
            "sourceUrl": f"https://www.openstreetmap.org/{r['el']['type']}/{r['el']['id']}",
            "descriptionSource": desc_src,
            "descriptionSourceUrl": desc_src_url,
            "imageCredit": image_credit,
            "imageSourceUrl": img["page"] if image_url else "",
            "wikidata": t.get("wikidata", ""),
            "subtype": SUBTYPE_KO.get(sub, sub),
        })

    # 음식점·카페: 진흥공단 데이터가 있으면 그것을 사용(상가 커버리지가 훨씬 넓음), 없으면 OSM 유지
    sm = semas.load(BBOX)
    if sm is not None:
        stores, src_label = sm
        out = [x for x in out if x["category"] not in ("food", "cafe")]
        seen = set()
        for x in stores:
            c = semas.classify(x)
            if not c or not x["name"] or not x["lat"]:
                continue
            name = f"{x['name']} {x['branch']}".strip()
            k = (name, round(x["lat"], 4), round(x["lon"], 4))
            if k in seen:
                continue
            seen.add(k)
            cat, label = c
            addr = x["road"] or x["jibun"]
            if x["floor"]:
                addr += f" ({x['floor']}층)"
            out.append({
                "id": f"semas-{x['id'].lower()}",
                "nameKo": name, "nameEn": "",
                "latitude": f"{x['lat']:.6f}", "longitude": f"{x['lon']:.6f}",
                "category": cat, "theme": THEME_OF[cat],
                "descriptionKo": f"상권업종 '{label}'(으)로 등록된 {'카페·디저트' if cat == 'cafe' else '음식점'}입니다.",
                "descriptionEn": "",
                "address": addr, "imageUrl": "",
                "source": "소상공인시장진흥공단", "license": "공공데이터 (이용허락범위 제한 없음)",
                "openingHours": "", "tags": label,
                "externalUrl": "", "recommendedDurationMinutes": "", "updatedAt": TODAY, "isSample": "false",
                "sourceUrl": "https://www.data.go.kr/data/15083033/fileData.do",
                "descriptionSource": f"{src_label} 업종 분류", "descriptionSourceUrl": "https://www.data.go.kr/data/15083033/fileData.do",
                "imageCredit": "", "imageSourceUrl": "", "wikidata": "", "subtype": label,
            })
        print(f"진흥공단 음식점·카페 {sum(1 for x in out if x['id'].startswith('semas-'))}곳으로 대체 ({src_label})")
    else:
        print("진흥공단 키/파일 없음 → 음식점·카페는 OpenStreetMap 데이터를 사용합니다")

    # 카테고리 → 이름 순으로 정렬 (사람이 CSV 를 읽기 쉽게)
    order = {"history": 0, "landmark": 1, "nature": 2, "cafe": 3, "food": 4}
    out.sort(key=lambda x: (order[x["category"]], x["nameKo"]))
    cols = list(out[0].keys())
    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(out)
    by = {}
    for x in out:
        by[x["category"]] = by.get(x["category"], 0) + 1
    print(f"저장: {OUT} ({len(out)}곳) {by}")
    print(f"사진 {sum(1 for x in out if x['imageUrl'])}곳, 위키 설명 {sum(1 for x in out if 'CC BY-SA' in x['descriptionSource'])}곳, 영문 이름 {sum(1 for x in out if x['nameEn'])}곳")


if __name__ == "__main__":
    main()
